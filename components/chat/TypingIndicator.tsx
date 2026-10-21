"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getInitials } from "@/lib/utils";

interface TypingUser {
  userId: string;
  username: string;
  imageUrl?: string | null;
}

/**
 * TypingIndicator — Premium animated typing indicator with user avatars,
 * gold animated dots, and auto-hide after 5 seconds of no typing activity.
 * Shows contextual user names and up to 3 avatars.
 */
export default function TypingIndicator({ typingUsers }: { typingUsers: TypingUser[] }) {
  const [visible, setVisible] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Update timestamp whenever typingUsers changes
  useEffect(() => {
    if (typingUsers.length > 0) {
      setVisible(true);
      setLastUpdateTime(Date.now());
    } else {
      setVisible(false);
    }
  }, [typingUsers]);

  // Auto-hide after 5 seconds of no typing
  useEffect(() => {
    if (typingUsers.length === 0) return;

    const timer = setTimeout(() => {
      setVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [lastUpdateTime, typingUsers.length]);

  if (!visible || typingUsers.length === 0) return null;

  const displayedUsers = typingUsers.slice(0, 3); // Show max 3 avatars
  const remainingCount = Math.max(0, typingUsers.length - 3);

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0].username} is typing...`
      : typingUsers.length === 2
        ? `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`
        : `${typingUsers[0].username} and ${typingUsers.length - 1} ${typingUsers.length === 2 ? "other" : "others"} are typing...`;

  return (
    <div className="typing-indicator animate-slide-in-up">
      {/* User Avatars */}
      <div className="typing-avatars">
        {displayedUsers.map((user) => (
          <div key={user.userId} className="typing-avatar">
            {user.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt={user.username}
                width={20}
                height={20}
                className="avatar-img"
              />
            ) : (
              <div className="avatar-fallback">
                {getInitials(user.username)}
              </div>
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="typing-avatar avatar-count">
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Animated Dots */}
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>

      {/* Text */}
      <span className="typing-text">{text}</span>

      <style jsx>{`
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 24px;
          min-height: 36px;
          animation: slideInUp 0.3s var(--ease-smooth);
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .typing-avatars {
          display: flex;
          align-items: center;
          gap: -4px;
          margin-left: 2px;
        }

        .typing-avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
          overflow: hidden;
          flex-shrink: 0;
          margin-left: -6px;
          background: var(--bg-tertiary);
          transition: transform 0.2s ease;
        }

        .typing-avatar:first-child {
          margin-left: 0;
        }

        .typing-avatar:hover {
          transform: scale(1.15);
          z-index: 1;
        }

        .typing-avatar :global(.avatar-img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        .avatar-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-gold);
          font-size: 8px;
          font-weight: 700;
          color: #1a1400;
        }

        .avatar-count {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          border: 2px solid var(--bg-secondary);
        }

        .typing-dots {
          display: flex;
          gap: 3px;
          align-items: center;
        }

        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-gold);
          opacity: 0.6;
          animation: typingBounce 1.4s ease-in-out infinite;
        }

        .typing-dot:nth-child(1) {
          animation-delay: 0s;
        }

        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.6;
          }
          30% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }

        .typing-text {
          font-size: 13px;
          color: var(--text-tertiary);
          font-weight: 500;
          letter-spacing: -0.01em;
        }

        @media (max-width: 768px) {
          .typing-indicator {
            padding: 6px 16px;
          }

          .typing-avatars {
            display: none; /* Hide avatars on mobile to save space */
          }
        }
      `}</style>
    </div>
  );
}
