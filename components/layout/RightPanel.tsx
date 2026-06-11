"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import {
  User as UserIcon,
  Users,
  Sparkles,
  X,
  Shield,
  Mail,
  Crown,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import AISummaryPanel from "@/components/chat/AISummaryPanel";

interface ChannelInfo {
  id: string;
  name: string;
  description: string | null;
  members?: { id: string; username: string; imageUrl: string | null; role: string }[];
  messageCount?: number;
}

/**
 * RightPanel — Column 4 (320px, collapsible).
 * Tabbed interface: Profile, Members, AI.
 */
export default function RightPanel({
  channel,
  isOpen,
  onClose,
}: {
  channel: ChannelInfo | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"profile" | "members" | "ai">("profile");

  if (!isOpen) return null;

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: UserIcon },
    { id: "members" as const, label: "Members", icon: Users },
    { id: "ai" as const, label: "AI", icon: Sparkles },
  ];

  return (
    <aside className="right-panel animate-slide-in-right">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`panel-tab ${activeTab === tab.id ? "panel-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              id={`right-tab-${tab.id}`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <button className="panel-close btn-ghost" onClick={onClose} id="right-panel-close">
          <X size={16} />
        </button>
      </div>

      <div className="divider-glow" />

      {/* Tab Content */}
      <div className="panel-body">
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="tab-content animate-fade-in">
            {/* User Card */}
            <div className="profile-card card">
              <div className="profile-avatar-section">
                {user?.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt={user.username || "User"}
                    width={64}
                    height={64}
                    className="profile-avatar"
                  />
                ) : (
                  <div className="profile-avatar-fallback">
                    {getInitials(user?.username || user?.firstName || "U")}
                  </div>
                )}
                <div className="profile-presence" />
              </div>
              <h3 className="profile-name">
                {user?.firstName} {user?.lastName}
              </h3>
              <p className="profile-username">@{user?.username}</p>

              <div className="profile-details">
                <div className="profile-detail-row">
                  <Mail size={14} />
                  <span>{user?.emailAddresses?.[0]?.emailAddress}</span>
                </div>
                <div className="profile-detail-row">
                  <Shield size={14} />
                  <span>Member</span>
                </div>
              </div>
            </div>

            {/* Server Roles */}
            <div className="section-block">
              <h4 className="section-label">
                <Crown size={13} />
                Server Roles
              </h4>
              <div className="role-list">
                <div className="role-badge role-badge--admin">
                  <span className="role-dot" style={{ background: "var(--accent-gold)" }} />
                  Admin
                </div>
                <div className="role-badge">
                  <span className="role-dot" style={{ background: "var(--accent-gold)" }} />
                  Member
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <div className="tab-content animate-fade-in">
            <div className="section-block">
              <h4 className="section-label">
                <Users size={13} />
                Channel Members — {channel?.members?.length || 0}
              </h4>
              <div className="member-list">
                {channel?.members?.map((member) => (
                  <div key={member.id} className="member-item" id={`member-${member.id}`}>
                    <div className="member-avatar-wrap">
                      {member.imageUrl ? (
                        <Image
                          src={member.imageUrl}
                          alt={member.username}
                          width={32}
                          height={32}
                          className="member-avatar-img"
                        />
                      ) : (
                        <div className="member-avatar-fallback">
                          {getInitials(member.username)}
                        </div>
                      )}
                    </div>
                    <div className="member-info">
                      <span className="member-name">{member.username}</span>
                      {member.role === "admin" && (
                        <span className="member-role-tag">Admin</span>
                      )}
                    </div>
                  </div>
                )) || (
                  <p className="empty-hint">No members info available</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Tab */}
        {activeTab === "ai" && (
          <div className="tab-content animate-fade-in">
            {channel ? (
              <AISummaryPanel
                channelId={channel.id}
                messageCount={channel.messageCount || 0}
                embedded
              />
            ) : (
              <div className="empty-hint">Select a channel to view AI insights</div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .right-panel {
          width: var(--right-panel-width);
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border-secondary);
          flex-shrink: 0;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          gap: 4px;
        }

        .panel-tabs {
          display: flex;
          align-items: center;
          gap: 2px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          padding: 3px;
        }

        .panel-tab {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s var(--ease-smooth);
          white-space: nowrap;
        }

        .panel-tab:hover {
          color: var(--text-secondary);
        }

        .panel-tab--active {
          background: var(--bg-elevated);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }

        .panel-close {
          padding: 6px !important;
          color: var(--text-muted) !important;
        }

        .panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .tab-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Profile Card */
        .profile-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 28px 20px;
        }

        .profile-avatar-section {
          position: relative;
          margin-bottom: 14px;
        }

        .profile-card :global(.profile-avatar) {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid var(--accent-gold-dim);
        }

        .profile-avatar-fallback {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 700;
          color: #1a1400;
        }

        .profile-presence {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 14px;
          height: 14px;
          background: var(--accent-emerald);
          border-radius: 50%;
          border: 3px solid var(--bg-secondary);
        }

        .profile-name {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
        }

        .profile-username {
          font-size: 13px;
          color: var(--text-tertiary);
          margin-top: 2px;
        }

        .profile-details {
          margin-top: 16px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .profile-detail-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-sm);
          font-size: 12px;
          color: var(--text-secondary);
        }

        .profile-detail-row :global(svg) {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        /* Section Blocks */
        .section-block {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .section-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--text-muted);
          padding: 0 4px;
        }

        /* Roles */
        .role-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .role-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .role-badge--admin {
          border-color: var(--accent-gold-dim);
          color: var(--accent-gold);
        }

        .role-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Members */
        .member-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .member-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          transition: background-color 0.15s ease;
          cursor: default;
        }

        .member-item:hover {
          background: var(--bg-hover);
        }

        .member-avatar-wrap {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
        }

        .member-item :global(.member-avatar-img) {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }

        .member-avatar-fallback {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: #1a1400;
        }

        .member-info {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .member-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .member-role-tag {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--accent-gold);
          background: var(--accent-gold-dim);
          padding: 2px 6px;
          border-radius: 999px;
        }

        .empty-hint {
          text-align: center;
          padding: 32px 16px;
          font-size: 13px;
          color: var(--text-muted);
        }

        @media (max-width: 1100px) {
          .right-panel {
            display: none;
          }
        }
      `}</style>
    </aside>
  );
}
