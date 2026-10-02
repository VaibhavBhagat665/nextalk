"use client";

import { useState } from "react";
import {
  Hash,
  Users,
  WifiOff,
  Phone,
  Video,
  PanelRightOpen,
  PanelRightClose,
  Settings,
  Bell,
  BellOff,
  Pin,
  Search,
} from "lucide-react";

interface ChannelHeaderProps {
  channelName: string;
  channelDescription?: string | null;
  channelIcon?: string;
  memberCount?: number;
  isConnected?: boolean;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onSearch?: () => void;
}

/**
 * ChannelHeader — Reusable header component for chat channels
 * Displays channel info, connection status, and action buttons
 */
export default function ChannelHeader({
  channelName,
  channelDescription,
  channelIcon = "#",
  memberCount = 0,
  isConnected = true,
  rightPanelOpen = false,
  onToggleRightPanel,
  onVoiceCall,
  onVideoCall,
  onSearch,
}: ChannelHeaderProps) {
  const [muted, setMuted] = useState(false);

  return (
    <>
      <header className="channel-header">
        <div className="header-left">
          <div className="header-icon">
            {channelIcon === "#" ? <Hash size={15} /> : <span>{channelIcon}</span>}
          </div>
          <div className="header-info">
            <h1 className="header-name">{channelName}</h1>
            {channelDescription && <p className="header-desc">{channelDescription}</p>}
          </div>
        </div>

        <div className="header-right">
          {!isConnected && (
            <div className="connection-badge offline">
              <WifiOff size={11} />
              <span>Reconnecting</span>
            </div>
          )}

          {onSearch && (
            <button
              className="header-btn"
              onClick={onSearch}
              data-tooltip="Search"
              id="search-btn"
            >
              <Search size={15} />
            </button>
          )}

          {onVoiceCall && (
            <button
              className="header-btn"
              onClick={onVoiceCall}
              data-tooltip="Voice Call"
              id="voice-call-btn"
            >
              <Phone size={15} />
            </button>
          )}

          {onVideoCall && (
            <button
              className="header-btn"
              onClick={onVideoCall}
              data-tooltip="Video Call"
              id="video-call-btn"
            >
              <Video size={15} />
            </button>
          )}

          <button
            className="header-btn"
            onClick={() => setMuted(!muted)}
            data-tooltip={muted ? "Unmute" : "Mute"}
            id="mute-btn"
          >
            {muted ? <BellOff size={15} /> : <Bell size={15} />}
          </button>

          {memberCount > 0 && (
            <div className="member-count" data-tooltip={`${memberCount} members`}>
              <Users size={13} />
              <span>{memberCount}</span>
            </div>
          )}

          {onToggleRightPanel && (
            <button
              className={`header-btn ${rightPanelOpen ? "header-btn--active" : ""}`}
              onClick={onToggleRightPanel}
              data-tooltip={rightPanelOpen ? "Close panel" : "Open panel"}
              id="right-panel-toggle"
            >
              {rightPanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            </button>
          )}
        </div>
      </header>

      <div className="divider-glow" />

      <style jsx>{`
        .channel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: var(--bg-secondary);
          gap: 12px;
          border-bottom: 1px solid var(--border-secondary);
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .header-icon {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-gold-dim);
          border-radius: 8px;
          color: var(--accent-gold);
          flex-shrink: 0;
          font-size: 16px;
        }

        .header-info {
          min-width: 0;
          flex: 1;
        }

        .header-name {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }

        .header-desc {
          font-size: 11px;
          color: var(--text-muted);
          margin: 1px 0 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .header-btn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--text-muted);
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .header-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .header-btn--active {
          color: var(--accent-gold);
          background: var(--accent-gold-dim);
        }

        .connection-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .connection-badge.offline {
          background: rgba(224, 107, 122, 0.08);
          color: var(--accent-rose);
          border: 1px solid rgba(224, 107, 122, 0.12);
        }

        .member-count {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-tertiary);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          flex-shrink: 0;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .member-count:hover {
          background: var(--bg-hover);
          border-color: var(--accent-gold);
        }

        .divider-glow {
          height: 1px;
          background: var(--gradient-divider);
          opacity: 0.5;
        }

        @media (max-width: 768px) {
          .channel-header {
            padding: 10px 14px 10px 48px;
          }
          .header-desc {
            display: none;
          }
        }

        @media (max-width: 1100px) {
          .member-count {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
