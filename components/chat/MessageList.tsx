"use client";

import { useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Image from "next/image";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import {
  Paperclip,
  Download,
  MessageSquare,
  ThumbsUp,
  Heart,
  Laugh,
  PartyPopper,
  Flame,
  Eye,
  Lock,
  MoreHorizontal,
} from "lucide-react";
import MessageContextMenu from "./MessageContextMenu";
import UserContextMenu from "./UserContextMenu";
import UserProfilePopover from "./UserProfilePopover";

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
  encrypted?: boolean;
  user?: {
    id: string;
    username: string;
    imageUrl: string | null;
    clerkId: string;
  };
  reactions?: { emoji: string; userId: string; username: string }[];
}

const REACTION_LIST = [
  { emoji: "thumbsup", icon: ThumbsUp, label: "Like" },
  { emoji: "heart", icon: Heart, label: "Love" },
  { emoji: "laugh", icon: Laugh, label: "Haha" },
  { emoji: "party", icon: PartyPopper, label: "Celebrate" },
  { emoji: "fire", icon: Flame, label: "Fire" },
  { emoji: "eyes", icon: Eye, label: "Seen" },
];

const REACTION_ICON_MAP: Record<string, typeof ThumbsUp> = {
  thumbsup: ThumbsUp,
  heart: Heart,
  laugh: Laugh,
  party: PartyPopper,
  fire: Flame,
  eyes: Eye,
};

/**
 * Formats a date as a user-friendly date separator label.
 */
function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * MessageList — Virtualized scrollable chat feed with avatar grouping, date separators,
 * file attachments, and reaction picker. Theme-aware styling with optimized rendering.
 */
export default function MessageList({
  messages,
  currentUserId,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onCopyLink,
  onViewProfile,
  onMessage,
  onVoiceCall,
  onVideoCall,
  onMuteUser,
  onKickUser,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: {
  messages: Message[];
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onCopyLink?: (messageId: string) => void;
  onViewProfile?: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onVoiceCall?: (userId: string) => void;
  onVideoCall?: (userId: string) => void;
  onMuteUser?: (userId: string) => void;
  onKickUser?: (userId: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const topObserverRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const wasAtBottomRef = useRef<boolean>(true);

  // Virtualization setup with overscan for smooth scrolling
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback((index: number) => {
      // Estimate message height based on content
      const msg = messages[index];
      if (!msg) return 60;
      
      let height = 30; // Base height for grouped message
      
      // Check if this message shows avatar (not grouped)
      const prevMsg = messages[index - 1];
      const prevUsername = prevMsg?.user?.username || prevMsg?.username;
      const username = msg.user?.username || msg.username;
      let showAvatar = true;
      
      if (prevMsg && prevUsername === username) {
        const currentTime = new Date(msg.createdAt).getTime();
        const prevTime = new Date(prevMsg.createdAt).getTime();
        const timeDiffMinutes = (currentTime - prevTime) / (1000 * 60);
        showAvatar = timeDiffMinutes > 5;
      }
      
      if (showAvatar) {
        height += 30; // Header + spacing
      }
      
      // Add height for content
      if (msg.content) {
        const lineCount = Math.ceil(msg.content.length / 50);
        height += lineCount * 22;
      }
      
      // Add height for file attachments
      if (msg.fileUrl) {
        height += msg.fileType?.startsWith("image/") ? 310 : 50;
      }
      
      // Add height for reactions
      if (msg.reactions && msg.reactions.length > 0) {
        height += 35;
      }
      
      // Add height for date separator
      const currentDate = new Date(msg.createdAt).toDateString();
      const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
      if (!prevMsg || currentDate !== prevDate) {
        height += 50;
      }
      
      return height;
    }, [messages]),
    overscan: 5, // Render 5 items above and below visible area for smooth scrolling
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && onLoadMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (topObserverRef.current) {
      observer.observe(topObserverRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore]);

  // Scroll position preservation logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if we were at the bottom before update
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    wasAtBottomRef.current = distanceFromBottom < 100;
  }, [messages]);

  // Auto-scroll to bottom on new messages if user was already at bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only auto-scroll if user was at the bottom
    if (wasAtBottomRef.current && messages.length > 0) {
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [messages.length, messages]);

  // Restore scroll position after loading older messages
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previousScrollHeight = previousScrollHeightRef.current;
    
    if (previousScrollHeight > 0 && isLoadingMore === false) {
      // Restore scroll position by calculating the difference in scroll height
      const currentScrollHeight = container.scrollHeight;
      const scrollDiff = currentScrollHeight - previousScrollHeight;
      
      if (scrollDiff > 0) {
        container.scrollTop += scrollDiff;
      }
      
      previousScrollHeightRef.current = 0;
    } else if (isLoadingMore) {
      // Store current scroll height before loading
      previousScrollHeightRef.current = container.scrollHeight;
    }
  }, [isLoadingMore]);

  const isImageFile = (type?: string | null) =>
    type?.startsWith("image/") || false;

  const items = virtualizer.getVirtualItems();

  return (
    <div className="message-list" ref={containerRef}>
      {messages.length === 0 && (
        <div className="empty-state animate-fade-in">
          <div className="empty-icon">
            <MessageSquare size={44} />
          </div>
          <h3>Start the conversation</h3>
          <p>Send the first message to get things going!</p>
        </div>
      )}

      {messages.length > 0 && (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {/* Invisible element to trigger infinite scroll */}
          {hasMore && <div ref={topObserverRef} style={{ height: 1, position: "absolute", top: 0 }} />}
          {isLoadingMore && (
            <div className="loading-more">
              <div className="spinner-small" />
            </div>
          )}

          {items.map((virtualItem) => {
            const index = virtualItem.index;
            const msg = messages[index];
            if (!msg) return null;

            const username = msg.user?.username || msg.username;
            const avatarUrl = msg.user?.imageUrl || msg.imageUrl;
            const msgId = msg.id || msg.tempId || `msg-${index}`;
            const prevMsg = messages[index - 1];
            const prevUsername = prevMsg?.user?.username || prevMsg?.username;
            
            // Message grouping logic: group consecutive messages from same user within 5 minutes
            let showAvatar = true;
            if (prevMsg && prevUsername === username) {
              const currentTime = new Date(msg.createdAt).getTime();
              const prevTime = new Date(prevMsg.createdAt).getTime();
              const timeDiffMinutes = (currentTime - prevTime) / (1000 * 60);
              // Only show avatar if more than 5 minutes have passed
              showAvatar = timeDiffMinutes > 5;
            }

            // Date separator logic
            const currentDate = new Date(msg.createdAt).toDateString();
            const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
            const showDateSeparator = !prevMsg || currentDate !== prevDate;

            // Group reactions by emoji
            const groupedReactions = (msg.reactions || []).reduce(
              (acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = [];
                acc[r.emoji]!.push(r);
                return acc;
              },
              {} as Record<string, typeof msg.reactions>
            );

            return (
              <div
                key={msgId}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {/* Date Separator */}
                {showDateSeparator && (
                  <div className="date-separator">
                    <div className="date-line" />
                    <span className="date-label">{formatDateSeparator(msg.createdAt)}</span>
                    <div className="date-line" />
                  </div>
                )}

                <div
                  className={`message-bubble ${showAvatar ? "message-bubble--spaced" : ""}`}
                  id={`message-${msgId}`}
                >
                  {showAvatar ? (
                    <UserProfilePopover
                      userId={msg.userId}
                      username={username}
                      imageUrl={avatarUrl}
                      isCurrentUser={msg.userId === currentUserId}
                      onMessage={onMessage}
                      onVoiceCall={onVoiceCall}
                      onVideoCall={onVideoCall}
                      onViewFullProfile={onViewProfile}
                    >
                      <UserContextMenu
                        userId={msg.userId}
                        username={username}
                        isCurrentUser={msg.userId === currentUserId}
                        canModerate={false}
                        onViewProfile={onViewProfile}
                        onMessage={onMessage}
                        onVoiceCall={onVoiceCall}
                        onVideoCall={onVideoCall}
                        onMute={onMuteUser}
                        onKick={onKickUser}
                      >
                        <div className="message-avatar">
                          {avatarUrl ? (
                            <Image
                              src={avatarUrl}
                              alt={username}
                              width={36}
                              height={36}
                              className="avatar-img"
                            />
                          ) : (
                            <div className="avatar-fallback">
                              {getInitials(username)}
                            </div>
                          )}
                        </div>
                      </UserContextMenu>
                    </UserProfilePopover>
                  ) : (
                    <div className="message-avatar-spacer" />
                  )}

                  <div className="message-body">
                    {showAvatar && (
                      <div className="message-header">
                        <UserProfilePopover
                          userId={msg.userId}
                          username={username}
                          imageUrl={avatarUrl}
                          isCurrentUser={msg.userId === currentUserId}
                          onMessage={onMessage}
                          onVoiceCall={onVoiceCall}
                          onVideoCall={onVideoCall}
                          onViewFullProfile={onViewProfile}
                        >
                          <UserContextMenu
                            userId={msg.userId}
                            username={username}
                            isCurrentUser={msg.userId === currentUserId}
                            canModerate={false}
                            onViewProfile={onViewProfile}
                            onMessage={onMessage}
                            onVoiceCall={onVoiceCall}
                            onVideoCall={onVideoCall}
                            onMute={onMuteUser}
                            onKick={onKickUser}
                          >
                            <span className="message-author">{username}</span>
                          </UserContextMenu>
                        </UserProfilePopover>
                        <span className="message-time">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    {msg.content && (
                      <div className="message-content-wrapper">
                        <p className={`message-text ${msg.content.includes('[Unable to decrypt]') ? 'message-text--error' : ''}`}>
                          {msg.content}
                        </p>
                        {msg.encrypted && !msg.content.includes('[Unable to decrypt]') && (
                          <span className="encrypted-badge" title="End-to-end encrypted">
                            <Lock size={11} />
                          </span>
                        )}
                      </div>
                    )}

                    {/* File attachment */}
                    {msg.fileUrl && (
                      <div className="message-attachment">
                        {isImageFile(msg.fileType) ? (
                          <div className="attachment-image">
                            <Image
                              src={msg.fileUrl}
                              alt={msg.fileName || "Image"}
                              width={400}
                              height={300}
                              className="attachment-img"
                              style={{ objectFit: "contain" }}
                            />
                          </div>
                        ) : (
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="attachment-file"
                          >
                            <Paperclip size={15} />
                            <span>{msg.fileName || "Download file"}</span>
                            <Download size={13} />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Reactions */}
                    {Object.keys(groupedReactions).length > 0 && (
                      <div className="message-reactions">
                        {Object.entries(groupedReactions).map(([emoji, users]) => {
                          const IconComponent = REACTION_ICON_MAP[emoji];
                          return (
                            <button
                              key={emoji}
                              className={`reaction ${
                                users?.some((u) => u.userId === currentUserId)
                                  ? "reaction--active"
                                  : ""
                              }`}
                              onClick={() => onReact(msgId, emoji)}
                            >
                              {IconComponent ? <IconComponent size={13} /> : <span>{emoji}</span>}
                              <span className="reaction-count">{users?.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reaction picker (on hover) */}
                  <div className="message-actions">
                    {REACTION_LIST.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        className="action-btn"
                        onClick={() => onReact(msgId, reaction.emoji)}
                        title={reaction.label}
                      >
                        <reaction.icon size={14} />
                      </button>
                    ))}
                    {/* Context Menu Button */}
                    <MessageContextMenu
                      messageId={msgId}
                      isOwnMessage={msg.userId === currentUserId}
                      canPin={true}
                      onReply={onReply}
                      onReact={() => {}}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onPin={onPin}
                      onCopyLink={onCopyLink}
                      trigger="click"
                    >
                      <button className="action-btn" title="More options">
                        <MoreHorizontal size={14} />
                      </button>
                    </MessageContextMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .message-list {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
        }

        /* Date separator */
        .date-separator {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 20px 0 8px;
          padding: 0 6px;
        }

        .date-line {
          flex: 1;
          height: 1px;
          background: var(--border-primary);
        }

        .date-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          white-space: nowrap;
          padding: 4px 14px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: 999px;
        }

        /* Empty state */
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          gap: 10px;
        }

        .empty-icon {
          margin-bottom: 8px;
          color: var(--accent-gold);
          opacity: 0.3;
        }

        .empty-state h3 {
          font-family: "Comic Neue", "Fredoka", sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: -0.3px;
        }

        .empty-state p {
          font-size: 14px;
          color: var(--text-muted);
        }

        /* Message bubble */
        .message-bubble {
          display: flex;
          gap: 12px;
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          position: relative;
          transition: background-color 0.2s ease;
          margin-top: 2px; /* Reduced spacing within groups */
        }

        .message-bubble:hover {
          background-color: var(--bg-hover);
        }

        .message-bubble--spaced {
          margin-top: 14px; /* Larger spacing between groups */
        }

        .message-avatar {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          margin-top: 2px;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .message-avatar:hover {
          opacity: 0.85;
        }

        .message-avatar :global(.avatar-img) {
          border-radius: 50%;
        }

        .avatar-fallback {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #1a1400;
        }

        .message-avatar-spacer {
          width: 36px;
          flex-shrink: 0;
        }

        .message-body {
          flex: 1;
          min-width: 0;
        }

        .message-header {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 3px;
        }

        .message-author {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .message-author:hover {
          color: var(--accent-gold);
          text-decoration: underline;
        }

        .message-time {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 400;
        }

        .message-content-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }

        .message-text {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-secondary);
          word-break: break-word;
          white-space: pre-wrap;
          flex: 1;
        }

        .message-text--error {
          color: var(--text-muted);
          font-style: italic;
          opacity: 0.8;
        }

        .encrypted-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          color: var(--accent-emerald);
          background: rgba(16, 185, 129, 0.08);
          border-radius: 4px;
          flex-shrink: 0;
          margin-top: 2px;
          cursor: help;
          transition: all 0.2s ease;
        }

        .encrypted-badge:hover {
          background: rgba(16, 185, 129, 0.15);
          transform: scale(1.1);
        }

        /* File attachment */
        .message-attachment {
          margin-top: 8px;
        }

        .attachment-image {
          border-radius: var(--radius);
          overflow: hidden;
          max-width: 400px;
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.2s ease;
        }

        .attachment-image:hover {
          box-shadow: var(--shadow-md);
        }

        .attachment-image :global(.attachment-img) {
          border-radius: var(--radius);
          max-height: 300px;
          width: auto;
        }

        .attachment-file {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
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
          background: var(--bg-elevated);
          border-color: var(--accent-gold-dim);
          color: var(--text-primary);
        }

        /* Reactions */
        .message-reactions {
          display: flex;
          gap: 4px;
          margin-top: 8px;
          flex-wrap: wrap;
        }

        .reaction {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          background: rgba(212, 162, 60, 0.05);
          border: 1px solid var(--border-primary);
          border-radius: 999px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s var(--ease-smooth);
          color: var(--text-tertiary);
        }

        .reaction:hover {
          background: var(--accent-gold-dim);
          border-color: rgba(212, 162, 60, 0.2);
          color: var(--accent-gold);
          transform: scale(1.05);
        }

        .reaction-pill.reacted { background: var(--accent-gold-dim); border-color: var(--accent-gold); color: var(--accent-gold); }
        .reaction-count { font-size: 11px; }

        .loading-more {
          display: flex; justify-content: center; padding: 12px 0;
        }
        .spinner-small {
          width: 20px; height: 20px; border: 2px solid var(--border-primary);
          border-top-color: var(--accent-gold); border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Hover actions */
        .message-actions {
          display: none;
          position: absolute;
          right: 10px;
          top: -14px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-sm);
          padding: 2px;
          gap: 0;
          box-shadow: var(--shadow-md);
          z-index: 5;
        }

        .message-bubble:hover .message-actions {
          display: flex;
        }

        .action-btn {
          background: none;
          border: none;
          padding: 5px 7px;
          cursor: pointer;
          border-radius: 5px;
          font-size: 14px;
          transition: all 0.15s ease;
          color: var(--text-muted);
          display: flex;
        }

        .action-btn:hover {
          background: var(--bg-hover);
          color: var(--accent-gold);
          transform: scale(1.15);
        }

        @media (max-width: 768px) {
          .message-list {
            padding: 16px;
          }

          .message-actions {
            display: none !important;
          }

          .attachment-image {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
