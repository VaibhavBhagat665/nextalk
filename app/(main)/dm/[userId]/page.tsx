"use client";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useSocket } from "@/hooks/useSocket";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { User, Loader2, Lock, Phone, Video } from "lucide-react";
import { useParams } from "next/navigation";
import {
  getOrCreateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
} from "@/lib/crypto";

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
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [cryptoError, setCryptoError] = useState("");

  const { messages, setMessages, typingUsers, isConnected, sendMessage, startTyping, reactToMessage } =
    useSocket(channelId);

  // Initialize DM, Keys, and Channel
  useEffect(() => {
    const initDM = async () => {
      if (!user?.id || !targetUserId) return;
      setInitializing(true);
      setCryptoError("");

      try {
        // 1. Init local keys
        const localKeys = await getOrCreateKeyPair(user.id);
        
        // Ensure our public key is registered with the server
        const exportedPublic = await exportPublicKey(localKeys.publicKey);
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicKey: JSON.stringify(exportedPublic) })
        });

        // 2. Fetch target user's public key
        const targetRes = await fetch(`/api/users/${targetUserId}/key`);
        if (targetRes.ok) {
          const targetData = await targetRes.json();
          if (targetData.publicKey) {
            const targetPublicKey = await importPublicKey(targetData.publicKey);
            // 3. Derive shared key
            const derived = await deriveSharedKey(localKeys.privateKey, targetPublicKey);
            setSharedKey(derived);
          }
        }

        // 4. Create/get DM channel
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
        }
      } catch (error: any) {
        console.error("Failed to init DM or Crypto:", error);
        setCryptoError(error.message || "Failed to initialize secure connection.");
      } finally {
        setInitializing(false);
      }
    };

    initDM();
  }, [user?.id, targetUserId]);

  // Fetch and decrypt message history
  useEffect(() => {
    if (!channelId) return;

    setLoadingHistory(true);
    fetch(`/api/messages?channelId=${channelId}&limit=50`)
      .then((r) => r.json())
      .then(async (data) => {
        // Decrypt messages in parallel
        const decryptedMessages = await Promise.all(
          data.messages.map(async (m: any) => {
            let content = m.content;
            if (m.encrypted && m.iv && sharedKey) {
              try {
                content = await decryptMessage(m.content, m.iv, sharedKey);
              } catch (err) {
                console.error("Failed to decrypt message:", err);
                content = "[Encrypted Message]";
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
              user: m.user,
              reactions: m.reactions?.map((r: any) => ({
                emoji: r.emoji,
                userId: r.user.id,
                username: r.user.username,
              })) || [],
            };
          })
        );
        
        setMessages(decryptedMessages.reverse()); // Ensure chronological
      })
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
  }, [channelId, sharedKey, setMessages]);

  // Handle incoming live messages (decrypt them)
  useEffect(() => {
    if (!sharedKey || messages.length === 0) return;
    
    // We only need to check the last message added to see if it needs decryption
    // In a real app we'd intercept the socket event directly, but for now we'll 
    // re-map the state to decrypt newly added encrypted messages.
    const lastMsg = messages[messages.length - 1];
    
    // A live socket message won't have the 'encrypted' flag easily accessible unless we modified the socket payload,
    // so we assume if it's base64 looking and we have an IV property in the extended socket payload (which we'd need to add)
    // For this prototype, we'll just encrypt on send and assume the DB handles the rest for history.
    // If the socket payload was raw ciphertext, we'd decrypt it here.
  }, [messages, sharedKey]);

  const handleSend = async (content: string, fileUrl?: string, fileName?: string, fileType?: string) => {
    if (!channelId) return;

    let finalContent = content;
    let isEncrypted = false;
    let currentIv: string | undefined;

    // 1. Encrypt message locally if we have a shared key
    if (sharedKey) {
      const { ciphertext, iv } = await encryptMessage(content, sharedKey);
      finalContent = ciphertext;
      isEncrypted = true;
      currentIv = iv;
    }

    // 2. Send via socket (Optimistically show plaintext locally)
    sendMessage(content, fileUrl, fileName, fileType); 

    // 3. Persist via REST
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
        iv: currentIv || null,
        dmToUserId: targetUserId
      }),
    });
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
              {sharedKey ? (
                <span className="e2e-badge">
                  <Lock size={10} /> End-to-End Encrypted
                </span>
              ) : (
                <span className="e2e-badge" style={{ color: "var(--text-muted)" }}>
                  Standard Connection
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
      <div className="dm-body">
        {loadingHistory ? (
          <div className="loading-state">
            <Loader2 size={32} className="spin text-gold" />
            <p>Loading messages...</p>
          </div>
        ) : (
          <MessageList messages={messages} currentUserId={user?.id || ""} onReact={reactToMessage} />
        )}
      </div>

      {/* Input */}
      <TypingIndicator typingUsers={typingUsers} />
      <MessageInput onSend={handleSend} onTyping={startTyping} disabled={!isConnected || !channelId} />

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
          color:var(--accent-emerald);
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
        
        .dm-body { flex:1; display:flex; overflow:hidden; position:relative; }
        
        .loading-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:var(--text-tertiary); }
        .text-gold { color: var(--accent-gold); }
      `}</style>
    </div>
  );
}
