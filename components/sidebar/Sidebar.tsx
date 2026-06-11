"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import ChannelList from "./ChannelList";
import CreateChannelDialog from "./CreateChannelDialog";
import BrowseChannelsDialog from "./BrowseChannelsDialog";
import OnlineUsers from "./OnlineUsers";
import {
  Plus, Compass, ChevronDown, ChevronRight,
  Search, Menu, X, Hash, Volume2, Copy, Check, Smartphone,
} from "lucide-react";
import DownloadAppDialog from "./DownloadAppDialog";

interface Channel {
  id: string;
  name: string;
  icon: string;
  type: string;
  description: string | null;
  isPrivate: boolean;
  isDM: boolean;
  lastMessage: { content: string; createdAt: string } | null;
  role: string;
  voiceUsers?: { id: string; username: string; imageUrl: string | null; muted: boolean }[];
}

interface User {
  id: string;
  username: string;
  imageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
}

export default function Sidebar({
  channels,
  currentUser,
  serverName,
  serverId,
  serverInviteCode,
}: {
  channels: Channel[];
  currentUser: User;
  serverName?: string;
  serverId?: string | null;
  serverInviteCode?: string;
}) {
  const pathname = usePathname();
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showBrowseChannels, setShowBrowseChannels] = useState(false);
  const [showDownloadApp, setShowDownloadApp] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [textOpen, setTextOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const filtered = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const textChannels = filtered.filter((c) => c.type === "text");
  const voiceChannels = filtered.filter((c) => c.type === "voice");

  const copyInvite = () => {
    if (serverInviteCode) {
      navigator.clipboard.writeText(serverInviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} id="sidebar-toggle">
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        {/* Server Header */}
        <div className="sidebar-header">
          <h2 className="server-name">{serverName || "NexTalk"}</h2>
          {serverInviteCode && (
            <button className="invite-btn" onClick={copyInvite} data-tooltip="Copy invite code">
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <div className="search-wrap">
            <Search size={13} />
            <input
              type="text" placeholder="Search channels..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input" id="sidebar-search"
            />
          </div>
        </div>

        <div className="sidebar-body">
          {/* Text Channels */}
          <div className="section">
            <div className="section-header" onClick={() => setTextOpen(!textOpen)} role="button" tabIndex={0} id="toggle-text-channels">
              {textOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <Hash size={11} />
              <span className="section-label">Text Channels</span>
              <span className="section-count">{textChannels.length}</span>
              <span className="section-action" role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setShowCreateChannel(true); }}
                data-tooltip="Create channel" id="create-channel-btn">
                <Plus size={13} />
              </span>
            </div>
            {textOpen && (
              <div className="section-content">
                {textChannels.length > 0 ? (
                  <ChannelList channels={textChannels} currentPath={pathname} />
                ) : (
                  <div className="empty-channels"><Hash size={14} /><span>No text channels</span></div>
                )}
              </div>
            )}
          </div>

          {/* Voice Channels */}
          <div className="section">
            <div className="section-header" onClick={() => setVoiceOpen(!voiceOpen)} role="button" tabIndex={0} id="toggle-voice-channels">
              {voiceOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <Volume2 size={11} />
              <span className="section-label">Voice Channels</span>
              <span className="section-count">{voiceChannels.length}</span>
              <span className="section-action" role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setShowCreateChannel(true); }}
                data-tooltip="Create voice channel" id="create-voice-channel-btn">
                <Plus size={13} />
              </span>
            </div>
            {voiceOpen && (
              <div className="section-content">
                {voiceChannels.length > 0 ? (
                  <ChannelList channels={voiceChannels} currentPath={pathname} isVoice />
                ) : (
                  <div className="empty-channels"><Volume2 size={14} /><span>No voice channels</span></div>
                )}
                <button className="browse-btn" onClick={() => setShowBrowseChannels(true)} id="browse-channels-btn">
                  <Compass size={12} /><span>Browse Channels</span>
                </button>
              </div>
            )}
          </div>

        {/* Online Users */}
        <div className="section">
          <div className="section-header" onClick={() => setOnlineOpen(!onlineOpen)} role="button" tabIndex={0} id="toggle-online">
            {onlineOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span className="section-label">Online</span>
          </div>
          {onlineOpen && (
            <div className="section-content">
              <OnlineUsers currentUserId={currentUser.id} />
            </div>
          )}
        </div>

        {/* Mobile App Download */}
        <div className="section section--bottom" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-secondary)' }}>
          <button 
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 0', fontSize: '12px' }}
            onClick={() => setShowDownloadApp(true)}
          >
            <Smartphone size={14} /> Get Mobile App
          </button>
        </div>
      </div>

      {showCreateChannel && <CreateChannelDialog onClose={() => setShowCreateChannel(false)} serverId={serverId} />}
      {showBrowseChannels && <BrowseChannelsDialog onClose={() => setShowBrowseChannels(false)} />}
      {showDownloadApp && <DownloadAppDialog onClose={() => setShowDownloadApp(false)} />}
    </aside>

      <style jsx>{`
        .mobile-toggle {
          display: none; position: fixed; top: 12px; left: 12px; z-index: 60;
          background: var(--bg-elevated); border: 2px solid var(--border-primary);
          color: var(--text-primary); padding: 10px; border-radius: var(--radius-sm); cursor: pointer;
        }
        .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40; }
        .sidebar {
          width: 252px; height: 100vh; display: flex; flex-direction: column;
          background: var(--gradient-sidebar); flex-shrink: 0; overflow: hidden;
        }
        .sidebar-header {
          padding: 14px 16px 10px; border-bottom: 1px solid var(--border-secondary);
          display: flex; align-items: center; justify-content: space-between;
        }
        .server-name {
          font-family: "Bubblegum Sans", cursive;
          font-size: 18px; font-weight: 400; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .invite-btn {
          background: var(--bg-tertiary); border: 1px solid var(--border-primary);
          color: var(--text-muted); padding: 5px; border-radius: 8px;
          cursor: pointer; display: flex; transition: all 0.2s ease;
        }
        .invite-btn:hover {
          background: var(--accent-gold-dim); color: var(--accent-gold);
          border-color: var(--accent-gold);
        }
        .sidebar-search { padding: 10px 12px 6px; }
        .search-wrap {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg-tertiary); border: 2px solid var(--border-primary);
          border-radius: var(--radius-lg); padding: 7px 12px;
          transition: border-color 0.2s ease;
        }
        .search-wrap:focus-within { border-color: var(--accent-gold); }
        .search-wrap :global(svg) { color: var(--text-muted); flex-shrink: 0; }
        .search-input {
          flex: 1; background: none; border: none; outline: none;
          color: var(--text-primary); font-size: 12px; font-family: inherit;
        }
        .search-input::placeholder { color: var(--text-muted); }
        .sidebar-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .section { padding: 4px 0; }
        .section--bottom {
          border-top: 1px solid var(--border-secondary);
          margin-top: auto; max-height: 200px; overflow-y: auto;
        }
        .section-header {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 14px; cursor: pointer; color: var(--text-muted);
          transition: color 0.15s ease; user-select: none;
        }
        .section-header:hover { color: var(--text-secondary); }
        .section-label {
          font-size: 10px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 1.3px; flex: 1;
        }
        .section-count {
          font-size: 10px; font-weight: 700; color: var(--text-muted);
          background: var(--bg-tertiary); padding: 1px 6px; border-radius: 999px;
        }
        .section-action {
          background: none; border: none; color: var(--text-muted);
          padding: 2px; border-radius: 6px; cursor: pointer;
          display: flex; transition: all 0.15s ease;
        }
        .section-action:hover { color: var(--accent-gold); background: var(--accent-gold-dim); }
        .section-content { animation: fadeIn 0.2s ease; }
        .empty-channels {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 16px; color: var(--text-muted); font-size: 12px;
        }
        .browse-btn {
          display: flex; align-items: center; gap: 7px;
          width: calc(100% - 16px); margin: 6px 8px 2px;
          padding: 8px 12px; border: 2px dashed var(--border-primary);
          border-radius: var(--radius-sm); background: transparent;
          color: var(--text-muted); font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.2s ease;
        }
        .browse-btn:hover {
          background: var(--bg-hover); color: var(--accent-gold);
          border-color: rgba(168, 85, 247, 0.20);
        }
        @media (max-width: 768px) {
          .mobile-toggle { display: flex; }
          .sidebar-overlay { display: block; }
          .sidebar {
            position: fixed; left: 0; top: 0;
            transform: translateX(-100%); z-index: 50;
            box-shadow: var(--shadow-lg);
            transition: transform 0.3s var(--ease-spring);
          }
          .sidebar--open { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
