"use client";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useSocket } from "@/hooks/useSocket";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { User, Loader2, Lock, Phone, Video, Shield, ShieldAlert, ShieldCheck, ChevronDown } from "lucide-react";
import { useParams } from "next/navigation";
import { encryptDM, decryptDM } from "@/lib/dm-encryption-manager";
import { generateX25519KeyPair } from "@nextalk/crypto";
import KeyVerificationModal from "@/components/modals/KeyVerificationModal";

interface DMUser {
  id: string;
  username: string;
  imageUrl: string | null;
  isOnline: boolean;
}

export default function DMPage() {
  const params = useParams();
  const targetUserId = params.userId as string;
  const { user } = useUser();
  
  const [channelId, setChannelId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false); // Changed default to false for optimistic loading
  const [initializing, setInitializing] = useState(false); // Changed default to false - no blocking
  const [myPrivateKey, setMyPrivateKey] = useState<Uint8Array | null>(null);
  const [myPublicKey, setMyPublicKey] = useState<string>("");
  const [theirPublicKey, setTheirPublicKey] = useState<Uint8Array | null>(null);
  const [theirPublicKeyBase64, setTheirPublicKeyBase64] = useState<string>("");
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [cryptoError, setCryptoError] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [targetUsername, setTargetUsername] = useState("");
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true); // Track if we're showing cached data
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedFreshData = useRef(false); // Prevent duplicate fetches

  const { messages, setMessages, typingUsers, isConnected, sendMessage, startTyping, reactToMessage } =
    useSocket(channelId);

  // OPTIMISTIC LOADING: Load cached messages immediately, before crypto or socket
  useEffect(() => {
    const loadCachedMessages = async () => {
      if (!user?.id || !targetUserId) return;
      
      try {
        // 1. First, get or create the DM channel (lightweight operation)
        const res = await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `dm-${[user.id, targetUserId].sort().join("-")}`,
            isDM: true,
            targetUserId,
          }),
        });

        if (res.ok) {
          const channel = await res.json();
          setChannelId(channel.id);
          
          // 2. Immediately try to load from cache (non-blocking)
          // This happens in parallel with crypto initialization
          const cacheRes = await fetch(`/api/messages?channelId=${channel.id}&limit=50&cacheOnly=true`);
          if (cacheRes.ok) {
            const cacheData = await cacheRes.json();
            if (cacheData.messages && cacheData.messages.length > 0) {
              // Show cached messages immediately (may be encrypted)
              const formattedMessages = cacheData.messages.map((m: any) => ({
                id: m.id,
                content: m.content, // Will be decrypted later if encrypted
                userId: m.user.id,
                username: m.user.username,
                imageUrl: m.user.imageUrl || "",
                channelId: channel.id,
                fileUrl: m.fileUrl,
                fileName: m.fileName,
                fileType: m.fileType,
                createdAt: m.createdAt,
                encrypted: m.encrypted || false,
                user: m.user,
                reactions: m.reactions?.map((r: any) => ({
                  emoji: r.emoji,
                  userId: r.user.id,
                  username: r.user.username,
                })) || [],
                _needsDecryption: m.encrypted || false, // Mark for later decryption
              }));
              setMessages(formattedMessages.reverse());
              setIsLoadingFromCache(false); // We have cached data showing
            }
          }
        }
      } catch (error) {
        console.error("Failed to load cached DM:", error);
        setIsLoadingFromCache(false);
      }
    };

    loadCachedMessages();
  }, [user?.id, targetUserId, setMessages]);

  // BACKGROUND INITIALIZATION: Initialize crypto and verification (non-blocking)
  useEffect(() => {
    const initCryptoAndVerification = async () => {
      if (!user?.id || !targetUserId) return;
      
      setCryptoError("");

      try {
        // 1. Initialize X25519 key pair for current user
        const keyPair = await generateX25519KeyPair();
        setMyPrivateKey(keyPair.privateKey);
        
        // 2. Store my public key on the server
        const myPublicKeyBase64 = Buffer.from(keyPair.publicKey).toString('base64');
        setMyPublicKey(myPublicKeyBase64);
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x25519PublicKey: myPublicKeyBase64 })
        });

        // 3. Fetch target user's public key and username in parallel with verification
        const [targetRes, verificationRes] = await Promise.all([
          fetch(`/api/users/${targetUserId}/key`),
          fetch(`/api/verification?verifiedUserId=${targetUserId}`)
        ]);

        if (targetRes.ok) {
          const targetData = await targetRes.json();
          setTargetUsername(targetData.username || "User");
          if (targetData.x25519PublicKey) {
            const theirKey = Buffer.from(targetData.x25519PublicKey, 'base64');
            setTheirPublicKey(theirKey);
            setTheirPublicKeyBase64(targetData.x25519PublicKey);
            setIsEncrypted(true);
          }
        }

        if (verificationRes.ok) {
          const verificationData = await verificationRes.json();
          setIsVerified(verificationData.verified || false);
        }
      } catch (error: any) {
        console.error("Failed to init crypto:", error);
        setCryptoError(error.message || "Failed to initialize secure connection.");
      }
    };

    initCryptoAndVerification();
  }, [user?.id, targetUserId]);

  // BACKGROUND DECRYPTION & FRESH DATA: Decrypt cached messages and fetch fresh data
  useEffect(() => {
    if (!channelId || !user?.id || hasFetchedFreshData.current) return;

    const decryptAndRefresh = async () => {
      // If we have keys, decrypt any cached messages that need it
      if (myPrivateKey && theirPublicKey) {
        setMessages(prev => prev.map(m => {
          // @ts-ignore - _needsDecryption is our custom flag
          if (m._needsDecryption && m.encrypted) {
            // Decrypt in background without blocking UI
            (async () => {
              try {
                const encryptedMessage = {
                  // @ts-ignore - encrypted messages have these fields
                  ciphertext: m.content,
                  iv: m.iv || '',
                  salt: m.salt || '',
                  keyVersion: m.keyVersion || 1,
                };
                const decrypted = await decryptDM(
                  encryptedMessage,
                  user.id,
                  targetUserId,
                  myPrivateKey,
                  theirPublicKey
                );
                
                // Update this specific message with decrypted content
                setMessages(current => current.map(msg => 
                  msg.id === m.id ? { ...msg, content: decrypted, _needsDecryption: false } : msg
                ));
              } catch (err) {
                console.error("Failed to decrypt cached message:", err);
                setMessages(current => current.map(msg => 
                  msg.id === m.id ? { ...msg, content: "[Unable to decrypt]", _needsDecryption: false } : msg
                ));
              }
            })();
          }
          return m;
        }));
      }

      // Fetch fresh data from database (non-blocking, in background)
      try {
        setLoadingHistory(true);
        const response = await fetch(`/api/messages?channelId=${channelId}&limit=50`);
        if (!response.ok) {
          setLoadingHistory(false);
          return;
        }

        const data = await response.json();
        
        // Decrypt messages in parallel
        const decryptedMessages = await Promise.all(
          data.messages.map(async (m: any) => {
            let content = m.content;
            
            // If message is encrypted and we have the keys, decrypt it
            if (m.encrypted && m.iv && m.salt && m.keyVersion && myPrivateKey && theirPublicKey) {
              try {
                const encryptedMessage = {
                  ciphertext: m.content,
                  iv: m.iv,
                  salt: m.salt,
                  keyVersion: m.keyVersion,
                };
                content = await decryptDM(
                  encryptedMessage,
                  user.id,
                  targetUserId,
                  myPrivateKey,
                  theirPublicKey
                );
              } catch (err) {
                console.error("Failed to decrypt message:", err);
                content = "[Unable to decrypt]";
              }
            }
            
            return {
              id: m.id,
              content,
              userId: m.user.id,
              username: m.user.username,
              imageUrl: m.user.imageUrl || "",
              channelId,
              fileUrl: m.fileUrl,
              fileName: m.fileName,
              fileType: m.fileType,
              createdAt: m.createdAt,
              encrypted: m.encrypted || false,
              user: m.user,
              reactions: m.reactions?.map((r: any) => ({
                emoji: r.emoji,
                userId: r.user.id,
                username: r.user.username,
              })) || [],
            };
          })
        );
        
        // Replace cached messages with fresh data
        setMessages(decryptedMessages.reverse());
        setIsLoadingFromCache(false);
        hasFetchedFreshData.current = true;
      } catch (error) {
        console.error("Failed to fetch fresh messages:", error);
      } finally {
        setLoadingHistory(false);
      }
    };

    decryptAndRefresh();
  }, [channelId, myPrivateKey, theirPublicKey, user?.id, targetUserId, setMessages]);
  
  // Fetch last read position
  useEffect(() => {
    if (!channelId) return;
    
    fetch(`/api/channels/${channelId}/last-read`)
      .then((r) => {
        if (!r.ok) return;
        return r.json();
      })
      .then((data) => {
        if (data?.lastReadAt) {
          setLastReadAt(new Date(data.lastReadAt));
        }
      })
      .catch(console.error);
  }, [channelId]);
  
  // Calculate unread count
  useEffect(() => {
    if (!lastReadAt || messages.length === 0) {
      setUnreadCount(0);
      return;
    }
    
    const lastReadTime = new Date(lastReadAt).getTime();
    const unread = messages.filter((msg) => {
      const msgTime = new Date(msg.createdAt).getTime();
      return msgTime > lastReadTime;
    }).length;
    
    setUnreadCount(unread);
  }, [messages, lastReadAt]);
  
  // Mark messages as read when user is at the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !channelId) return;
    
    const checkAndMarkAsRead = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // If user is near the bottom (within 100px), mark as read after 1 second
      if (distanceFromBottom < 100 && messages.length > 0) {
        if (markAsReadTimeoutRef.current) {
          clearTimeout(markAsReadTimeoutRef.current);
        }
        
        markAsReadTimeoutRef.current = setTimeout(() => {
          fetch(`/api/channels/${channelId}/read`, {
            method: "PATCH",
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.lastReadAt) {
                setLastReadAt(new Date(data.lastReadAt));
              }
            })
            .catch(console.error);
        }, 1000);
      } else {
        // Clear timeout if user scrolled up
        if (markAsReadTimeoutRef.current) {
          clearTimeout(markAsReadTimeoutRef.current);
          markAsReadTimeoutRef.current = null;
        }
      }
    };
    
    container.addEventListener("scroll", checkAndMarkAsRead);
    // Check immediately on mount
    checkAndMarkAsRead();
    
    return () => {
      container.removeEventListener("scroll", checkAndMarkAsRead);
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [channelId, messages]);
  
  // Track scroll position for jump button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollBtn(distanceFromBottom > 200);
    };
    
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);
  
  const scrollToBottom = () => {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const handleSend = async (content: string, fileUrl?: string, fileName?: string, fileType?: string) => {
    if (!channelId || !user?.id) return;

    let finalContent = content;
    let isEncrypted = false;
    let encryptedData: { iv: string; salt: string; keyVersion: number } | undefined;

    // 1. Encrypt message if we have the necessary keys
    if (myPrivateKey && theirPublicKey && isEncrypted) {
      try {
        const encrypted = await encryptDM(
          content,
          user.id,
          targetUserId,
          myPrivateKey,
          theirPublicKey
        );
        finalContent = encrypted.ciphertext;
        isEncrypted = true;
        encryptedData = {
          iv: encrypted.iv,
          salt: encrypted.salt,
          keyVersion: encrypted.keyVersion,
        };
      } catch (err) {
        console.error("Failed to encrypt message:", err);
        // Fall back to sending unencrypted
        isEncrypted = false;
      }
    }

    // 2. Send via socket (Optimistically show plaintext locally)
    sendMessage(content, fileUrl, fileName, fileType); 

    // 3. Persist via REST with encryption metadata
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        channelId, 
        content: finalContent, 
        fileUrl, 
        fileName, 
        fileType,
        encrypted: isEncrypted,
        iv: encryptedData?.iv || null,
        salt: encryptedData?.salt || null,
        keyVersion: encryptedData?.keyVersion || null,
        dmToUserId: targetUserId
      }),
    });
  };

  const handleVerification = (verified: boolean) => {
    setIsVerified(verified);
    setShowVerificationModal(false);
  };



  return (
    <div className="dm-page">
      {/* Header */}
      <header className="dm-header glass-strong">
        <div className="header-info">
          <div className="header-avatar">
            <User size={18} />
          </div>
          <div>
            <h1 className="header-name">Direct Message</h1>
            <div className="header-badges">
              {isEncrypted ? (
                <button 
                  className="e2e-badge e2e-badge--active e2e-badge--clickable"
                  onClick={() => setShowVerificationModal(true)}
                  title="Click to verify encryption"
                >
                  {isVerified ? <ShieldCheck size={10} /> : <Shield size={10} />}
                  {isVerified ? "Verified" : "End-to-End Encrypted"}
                </button>
              ) : cryptoError ? (
                <span className="e2e-badge e2e-badge--error">
                  <ShieldAlert size={10} /> Encryption Failed
                </span>
              ) : (
                <span className="e2e-badge e2e-badge--inactive">
                  <Lock size={10} /> Connecting...
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          {/* Call actions */}
          <button className="action-btn" data-tooltip="Start Voice Call" id="dm-voice-btn">
            <Phone size={16} />
          </button>
          <button className="action-btn" data-tooltip="Start Video Call" id="dm-video-btn">
            <Video size={16} />
          </button>

          <div className="divider" />

          <div className="connection-status" title={isConnected ? "Connected" : "Connecting..."}>
            <div className={isConnected ? "online-dot" : "offline-dot"} />
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="dm-body" ref={scrollContainerRef}>
        {messages.length === 0 && !isLoadingFromCache ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p className="empty-title">No messages yet</p>
            <p className="empty-subtitle">Start the conversation!</p>
          </div>
        ) : (
          <>
            <MessageList messages={messages} currentUserId={user?.id || ""} lastReadAt={lastReadAt} onReact={reactToMessage} />
            
            {showScrollBtn && (
              <button className="scroll-btn animate-scale-in" onClick={scrollToBottom}>
                <ChevronDown size={16} />
                {unreadCount > 0 && (
                  <span className="scroll-btn-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
            )}
            
            {/* Show subtle loading indicator in header when fetching fresh data */}
            {loadingHistory && (
              <div className="refresh-indicator" title="Syncing messages...">
                <Loader2 size={12} className="spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <TypingIndicator typingUsers={typingUsers} />
      <MessageInput 
        onSend={handleSend} 
        onTyping={startTyping} 
        disabled={!isConnected || !channelId} 
        encrypted={isEncrypted && !!myPrivateKey && !!theirPublicKey}
      />

      {/* Key Verification Modal */}
      {showVerificationModal && myPublicKey && theirPublicKeyBase64 && user && (
        <KeyVerificationModal
          userId={targetUserId}
          username={targetUsername}
          myUserId={user.id}
          myPublicKey={myPublicKey}
          theirPublicKey={theirPublicKeyBase64}
          isVerified={isVerified}
          onClose={() => setShowVerificationModal(false)}
          onVerify={handleVerification}
        />
      )}

      <style jsx>{`
        .dm-page { display:flex; flex-direction:column; height:100%; position:relative; background:var(--bg-primary); }
        
        .dm-header { 
          display:flex; 
          align-items:center; 
          justify-content:space-between; 
          padding:14px 24px; 
          border-bottom:1px solid var(--border-secondary); 
          z-index:5; 
        }
        
        .header-info { display:flex; align-items:center; gap:12px; }
        .header-avatar { 
          width:36px; height:36px; 
          display:flex; align-items:center; justify-content:center; 
          background:var(--bg-tertiary); border:1px solid var(--border-primary); 
          border-radius:10px; color:var(--text-secondary); 
        }
        
        .header-name { font-family:"Fredoka", "Comic Neue", sans-serif; font-size:16px; font-weight:700; color:var(--text-primary); }
        
        .header-badges { display:flex; align-items:center; gap:6px; margin-top:2px; }
        .e2e-badge {
          display:flex; align-items:center; gap:4px;
          font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;
        }
        
        .e2e-badge--clickable {
          background: transparent;
          border: 1px solid var(--accent-emerald);
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .e2e-badge--clickable:hover {
          background: var(--accent-emerald);
          color: white;
        }
        
        .e2e-badge--active {
          color: var(--accent-emerald);
        }
        
        .e2e-badge--inactive {
          color: var(--text-muted);
        }
        
        .e2e-badge--error {
          color: var(--accent-rose);
        }
        
        .verified-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          background: var(--accent-emerald);
          color: white;
          border-radius: 50%;
          font-size: 9px;
          font-weight: 700;
          margin-left: 4px;
        }

        .header-actions { display:flex; align-items:center; gap:12px; }
        
        .action-btn {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          background: transparent; border: none; border-radius: 8px;
          color: var(--text-secondary); cursor: pointer;
          transition: all 0.2s;
        }
        .action-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        
        .divider { width: 1px; height: 16px; background: var(--border-primary); margin: 0 4px; }

        .connection-status { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:500; color:var(--text-tertiary); }
        
        .dm-body { flex:1; display:flex; overflow-y:auto; overflow-x:hidden; position:relative; }
        
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
          color: var(--text-tertiary);
        }
        
        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
          filter: grayscale(0.3);
        }
        
        .empty-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        
        .empty-subtitle {
          font-size: 14px;
          color: var(--text-tertiary);
        }
        
        .refresh-indicator {
          position: fixed;
          top: 70px;
          right: 24px;
          padding: 8px 12px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-tertiary);
          box-shadow: var(--shadow-sm);
          z-index: 10;
          pointer-events: none;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .scroll-btn {
          position: sticky;
          bottom: 12px;
          align-self: center;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-primary);
          border-radius: 50%;
          color: var(--text-secondary);
          cursor: pointer;
          box-shadow: var(--shadow-md);
          transition: all 0.2s ease;
          z-index: 5;
        }

        .scroll-btn:hover {
          background: var(--accent-gold-dim);
          color: var(--accent-gold);
          border-color: rgba(197, 165, 90, 0.2);
        }
        
        .scroll-btn-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-rose);
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: 999px;
          border: 2px solid var(--bg-secondary);
          box-shadow: 0 2px 8px rgba(224, 107, 122, 0.3);
        }
      `}</style>
    </div>
  );
}
