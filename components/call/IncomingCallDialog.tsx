"use client";

import { Phone, Video, PhoneOff, PhoneIncoming } from "lucide-react";

interface IncomingCallDialogProps {
  caller: { username: string; imageUrl: string };
  callType: "voice" | "video";
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallDialog({
  caller,
  callType,
  onAccept,
  onDecline,
}: IncomingCallDialogProps) {
  return (
    <div className="incoming-overlay animate-fade-in">
      <div className="incoming-card glass-strong">
        <div className="caller-info">
          <div className="avatar-pulse">
            {caller.imageUrl ? (
              <img src={caller.imageUrl} alt={caller.username} className="caller-avatar" />
            ) : (
              <div className="caller-fallback">{caller.username[0].toUpperCase()}</div>
            )}
          </div>
          <div className="caller-details">
            <h2>{caller.username}</h2>
            <p>Incoming {callType} call...</p>
          </div>
        </div>

        <div className="call-actions">
          <button className="action-btn decline" onClick={onDecline}>
            <PhoneOff size={24} />
          </button>
          <button className="action-btn accept" onClick={onAccept}>
            {callType === "video" ? <Video size={24} /> : <PhoneIncoming size={24} />}
          </button>
        </div>
      </div>

      <style jsx>{`
        .incoming-overlay {
          position: fixed;
          top: 32px;
          right: 32px;
          z-index: 100;
          animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .incoming-card {
          width: 300px;
          padding: 20px;
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-glow);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px var(--accent-gold-dim);
          display: flex;
          flex-direction: column;
          gap: 24px;
          background: var(--bg-elevated);
        }

        .caller-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .avatar-pulse {
          position: relative;
          border-radius: 50%;
        }

        .avatar-pulse::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid var(--accent-gold);
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          opacity: 0.5;
        }

        .caller-avatar, .caller-fallback {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          position: relative;
          z-index: 2;
        }

        .caller-avatar {
          object-fit: cover;
        }

        .caller-fallback {
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: #1a1400;
        }

        .caller-details h2 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 18px;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .caller-details p {
          font-size: 13px;
          color: var(--accent-gold);
          font-weight: 500;
        }

        .call-actions {
          display: flex;
          justify-content: space-around;
          gap: 16px;
        }

        .action-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          color: white;
        }

        .action-btn.decline {
          background: var(--accent-rose);
        }

        .action-btn.decline:hover {
          background: #e11d48;
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4);
          transform: translateY(-2px);
        }

        .action-btn.accept {
          background: var(--accent-emerald);
        }

        .action-btn.accept:hover {
          background: #059669;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
          transform: translateY(-2px);
        }

        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .3; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
