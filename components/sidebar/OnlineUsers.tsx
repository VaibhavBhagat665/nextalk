"use client";

import { usePresence } from "@/hooks/usePresence";
import Image from "next/image";
import { useState } from "react";
import { getInitials } from "@/lib/utils";
import UserProfileModal from "@/components/modals/UserProfileModal";

export default function OnlineUsers({ currentUserId }: { currentUserId: string }) {
  const { onlineUsers } = usePresence();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Filter out current user
  const otherUsers = onlineUsers.filter((u) => u.userId !== currentUserId);

  return (
    <div className="online-users-wrapper">
      <div className="online-users">
        <div className="online-header">
          <span className="online-title">Online — {otherUsers.length}</span>
        </div>
        <div className="online-list">
          {otherUsers.map((user, index) => (
            <button
              key={user.userId}
              onClick={() => setSelectedUser(user.userId)}
              className="online-user border-none bg-transparent w-full text-left"
              id={`online-user-${user.userId}`}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="user-avatar-wrap">
                {user.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt={user.username}
                    width={28}
                    height={28}
                    className="user-avatar-img"
                  />
                ) : (
                  <div className="user-avatar-fallback">
                    {getInitials(user.username)}
                  </div>
                )}
                <div className="online-dot" />
              </div>
              <span className="user-name">{user.username}</span>
            </button>
          ))}

          {otherUsers.length === 0 && (
            <p className="no-users">No one else online</p>
          )}
        </div>
      </div>

      {selectedUser && (
        <UserProfileModal userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      <style jsx>{`
        .online-users {
          padding: 8px 0;
        }

        .online-header {
          padding: 4px 18px 8px;
        }

        .online-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-tertiary);
        }

        .online-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 8px;
        }

        .online-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          color: var(--text-secondary);
          animation: fadeIn 0.3s ease-out backwards;
        }

        .online-user:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .user-avatar-wrap {
          position: relative;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
        }

        .user-avatar-wrap :global(.user-avatar-img) {
          border-radius: 50%;
          width: 28px;
          height: 28px;
        }

        .user-avatar-fallback {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          color: #1a1400;
        }

        .user-avatar-wrap .online-dot {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 10px;
          height: 10px;
          border: 2px solid var(--bg-secondary);
        }

        .user-name {
          font-size: 13px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .no-users {
          text-align: center;
          padding: 12px 16px;
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
