"use client";

import Image from "next/image";
import {
  X,
  Clock,
  ThumbsUp,
  Heart,
  Laugh,
  PartyPopper,
  Flame,
  Eye,
  Paperclip,
  Download,
} from "lucide-react";
import { formatRelativeTime, getInitials } from "@/lib/utils";

interface Message {
  id?: string;
  tempId?: string;
  content: string;
  userId: string;
  username: string;
  imageUrl: string;
  channelId: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    imageUrl: string | null;
    clerkId: string;
  };
  reactions?: { emoji: string; userId: string; username: string }[];
}

const REACTION_ICON_MAP: Record<string, typeof ThumbsUp> = {
  thumbsup: ThumbsUp,
  heart: Heart,
  laugh: Laugh,
  party: PartyPopper,
  fire: Flame,
  eyes: Eye,
};

/**
 * MessageDetailDrawer — Slide-in drawer showing a single message in detail
 * with full content, author info, file attachments, and reactions with usernames.
 */
export default function MessageDetailDrawer({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  const username = message.user?.username || message.username;
  const avatarUrl = message.user?.imageUrl || message.imageUrl;
  const isImageFile = (type?: string | null) => type?.startsWith("image/") || false;

  // Group reactions by emoji
  const groupedReactions = (message.reactions || []).reduce(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = [];
      acc[r.emoji]!.push(r);
      return acc;
    },
    {} as Record<string, typeof message.reactions>
  );

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="drawer glass-strong animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="drawer-header">
          <h3>Message Detail</h3>
          <button className="btn-ghost" onClick={onClose} id="drawer-close">
            <X size={16} />
          </button>
        </div>

        <div className="divider-glow" />

        <div className="drawer-body">
          {/* Author info */}
          <div className="author-section">
            <div className="author-avatar">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={username}
                  width={48}
                  height={48}
                  className="author-img"
                />
              ) : (
                <div className="author-fallback">
                  {getInitials(username)}
                </div>
              )}
            </div>
            <div className="author-info">
              <span className="author-name">{username}</span>
              <span className="author-time">
                <Clock size={12} />
                {formatRelativeTime(message.createdAt)}
              </span>
            </div>
          </div>

          {/* Message content */}
          {message.content && (
            <div className="message-content card">
              <p>{message.content}</p>
            </div>
          )}

          {/* File attachment */}
          {message.fileUrl && (
            <div className="attachment-section">
              <h4 className="section-label">Attachment</h4>
              {isImageFile(message.fileType) ? (
                <div className="attachment-image-wrap">
                  <Image
                    src={message.fileUrl}
                    alt={message.fileName || "Image"}
                    width={400}
                    height={300}
                    className="attachment-img"
                    style={{ objectFit: "contain" }}
                  />
                </div>
              ) : (
                <a
                  href={message.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="attachment-file"
                >
                  <Paperclip size={15} />
                  <span>{message.fileName || "Download file"}</span>
                  <Download size={13} />
                </a>
              )}
            </div>
          )}

          {/* Reactions */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className="reactions-section">
              <h4 className="section-label">Reactions</h4>
              <div className="reaction-list">
                {Object.entries(groupedReactions).map(([emoji, users]) => {
                  const IconComponent = REACTION_ICON_MAP[emoji];
                  return (
                    <div key={emoji} className="reaction-detail">
                      <div className="reaction-icon-wrap">
                        {IconComponent ? <IconComponent size={16} /> : <span>{emoji}</span>}
                      </div>
                      <div className="reaction-users">
                        <span className="reaction-count">{users?.length}</span>
                        <span className="reaction-names">
                          {users?.map((u) => u.username).join(", ")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          justify-content: flex-end;
        }

        .drawer {
          width: 400px;
          max-width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg);
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
        }

        .drawer-header h3 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Author */
        .author-section {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .author-avatar {
          flex-shrink: 0;
        }

        .drawer :global(.author-img) {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--accent-gold-dim);
        }

        .author-fallback {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          color: #1a1400;
        }

        .author-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .author-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .author-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* Message content */
        .message-content p {
          font-size: 15px;
          line-height: 1.7;
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
        }

        /* Section labels */
        .section-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--text-muted);
          margin-bottom: 10px;
        }

        /* Attachments */
        .attachment-image-wrap {
          border-radius: var(--radius);
          overflow: hidden;
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-sm);
        }

        .drawer :global(.attachment-img) {
          width: 100%;
          max-height: 300px;
          object-fit: contain;
        }

        .attachment-file {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .attachment-file:hover {
          background: var(--bg-hover);
          border-color: var(--accent-gold-dim);
          color: var(--text-primary);
        }

        /* Reactions */
        .reaction-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .reaction-detail {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-sm);
        }

        .reaction-icon-wrap {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-gold-dim);
          border-radius: 8px;
          color: var(--accent-gold);
          flex-shrink: 0;
        }

        .reaction-users {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .reaction-count {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .reaction-names {
          font-size: 12px;
          color: var(--text-tertiary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .drawer {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
