"use client";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useSocket } from "@/hooks/useSocket";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { User, Loader2, Lock, Phone, Video, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
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
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [initializing, setInitializing] = useState(true);
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

  const { messages, setMessages, typingUsers, isConnected, sendMessage, startTyping, reactToMessage } =
    useSocket(channelId);

  // Check verification status
  useEffect(() => {
    if (!targetUserId) return;
    
    setLoadingVerification(true);
    fetch(`/api/verification?verifiedUserId=${targetUserId}`)
      .then((res) => res.json())
      .then((data) => {
        setIsVerified(data.verified || false);
      })
      .catch((error) => {
        console.error("Failed to fetch verification status:", error);
      })
      .finally(() => {
        setLoadingVerification(false);
      });
  }, [targetUserId]);

  // Initialize DM, Keys, and Channel
  useEffect(() => {
    const initDM = async () => {
      if (!user?.id || !targetUserId) return;
      setInitializing(true);
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

        // 3. Fetch target user's public key and username
        const targetRes = await fetch(`/api/users/${targetUserId}/key`);
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
    if (!channelId || !myPrivateKey || !user?.id) return;

    setLoadingHistory(true);
    fetch(`/api/messages?channelId=${channelId}&limit=50`)
      .then((r) => r.json())
      .then(async (data) => {
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
        
        setMessages(decryptedMessages.reverse()); // Ensure chronological
      })
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
  }, [channelId, myPrivateKey, theirPublicKey, user?.id, targetUserId, setMessages]);

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
        
        .dm-body { flex:1; display:flex; overflow:hidden; position:relative; }
        
        .loading-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:var(--text-tertiary); }
        .text-gold { color: var(--accent-gold); }
      `}</style>
    </div>
  );
}
