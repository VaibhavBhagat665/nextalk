"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, LogOut, Trash2, MoreVertical, Volume2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { getChannelIcon } from "@/lib/channel-icons";

interface Channel {
  id: string;
  name: string;
  icon: string;
  type?: string;
  description: string | null;
  isPrivate: boolean;
  isDM: boolean;
  lastMessage: { content: string; createdAt: string } | null;
  role: string;
  voiceUsers?: { id: string; username: string; imageUrl: string | null; muted: boolean }[];
}

export default function ChannelList({
  channels,
  currentPath,
  isVoice,
}: {
  channels: Channel[];
  currentPath: string;
  isVoice?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentServerId = searchParams.get("server");
  const [contextMenu, setContextMenu] = useState<{ channelId: string; x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent, channelId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ channelId, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleLeave = async (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    if (channel?.name === "general") { closeContextMenu(); return; }
    setLeaving(channelId);
    closeContextMenu();
    try {
      const res = await fetch("/api/channels/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (res.ok) {
        if (currentPath === `/channel/${channelId}`) {
          router.push(currentServerId ? `/channel?server=${currentServerId}` : "/channel");
        }
        router.refresh();
      }
    } catch (err) { console.error("Leave failed:", err); }
    finally { setLeaving(null); }
  };

  return (
    <>
      {contextMenu && <div className="context-backdrop" onClick={closeContextMenu} />}

      <nav className="channel-list">
        {channels.map((channel, index) => {
          const isActive = currentPath === `/channel/${channel.id}`;
          const Icon = isVoice ? Volume2 : getChannelIcon(channel.icon);
          const voiceUsers = channel.voiceUsers || [];
          const href = currentServerId ? `/channel/${channel.id}?server=${currentServerId}` : `/channel/${channel.id}`;

          return (
            <div key={channel.id} className="channel-item-wrap" onContextMenu={(e) => handleContextMenu(e, channel.id)}>
              <Link
                href={href}
                className={`channel-item ${isActive ? "channel-item--active" : ""} ${leaving === channel.id ? "channel-item--leaving" : ""} ${isVoice ? "channel-item--voice" : ""}`}
                id={`channel-${channel.id}`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {isActive && <div className="active-indicator" />}
                <div className={`channel-icon ${isActive ? "channel-icon--active" : ""} ${isVoice ? "channel-icon--voice" : ""}`}>
                  {channel.isPrivate ? <Lock size={15} /> : <Icon size={15} />}
                </div>
                <div className="channel-info">
                  <span className="channel-name">{channel.name}</span>
                  {!isVoice && channel.lastMessage && (
                    <span className="channel-preview">
                      {channel.lastMessage.content.length > 30
                        ? channel.lastMessage.content.slice(0, 30) + "..."
                        : channel.lastMessage.content}
                    </span>
                  )}
                  {isVoice && voiceUsers.length > 0 && (
                    <span className="voice-count">{voiceUsers.length} connected</span>
                  )}
                </div>
                {!isVoice && channel.lastMessage && (
                  <span className="channel-time">{formatRelativeTime(channel.lastMessage.createdAt)}</span>
                )}
              </Link>

              {/* Voice users avatars */}
              {isVoice && voiceUsers.length > 0 && (
                <div className="voice-users">
                  {voiceUsers.map((u) => (
                    <div key={u.id} className="voice-user" data-tooltip={u.username}>
                      {u.imageUrl ? (
                        <img src={u.imageUrl} alt={u.username} className="voice-user-avatar" />
                      ) : (
                        <div className="voice-user-fallback">{u.username[0].toUpperCase()}</div>
                      )}
                      {u.muted && <div className="voice-muted-dot" />}
                    </div>
                  ))}
                </div>
              )}

              <button className="channel-more" onClick={(e) => handleContextMenu(e, channel.id)} id={`channel-more-${channel.id}`}>
                <MoreVertical size={14} />
              </button>
            </div>
          );
        })}

        {channels.length === 0 && (
          <div className="no-channels">
            <p>No channels yet</p>
            <p className="hint">Create one to get started!</p>
          </div>
        )}
      </nav>

      {contextMenu && (() => {
        const channel = channels.find((c) => c.id === contextMenu.channelId);
        const isGeneral = channel?.name === "general";
        return (
          <div className="context-menu glass-strong animate-fade-in" style={{ top: contextMenu.y, left: contextMenu.x }} id="channel-context-menu">
            {!isGeneral && (
              <button className="context-item context-item--danger" onClick={() => handleLeave(contextMenu.channelId)} id="leave-channel-btn">
                <LogOut size={14} /><span>Leave Channel</span>
              </button>
            )}
            {channel?.role === "admin" && !isGeneral && (
              <button className="context-item context-item--danger" onClick={async () => {
                closeContextMenu();
                if (confirm(`Delete #${channel.name}? This cannot be undone.`)) {
                  await fetch(`/api/channels/${channel.id}`, { method: "DELETE" });
                  router.push("/channel"); router.refresh();
                }
              }} id="delete-channel-btn">
                <Trash2 size={14} /><span>Delete Channel</span>
              </button>
            )}
            {isGeneral && (
              <div className="context-item context-item--disabled"><span>Cannot leave #general</span></div>
            )}
          </div>
        );
      })()}

      <style jsx>{`
        .context-backdrop { position: fixed; inset: 0; z-index: 90; }
        .channel-list { display: flex; flex-direction: column; gap: 3px; padding: 0 8px; }
        .channel-item-wrap { position: relative; }
        .channel-more {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--text-muted); padding: 4px;
          border-radius: 8px; cursor: pointer; opacity: 0;
          transition: all 0.2s var(--ease-smooth); z-index: 2; display: flex;
        }
        .channel-item-wrap:hover .channel-more { opacity: 1; }
        .channel-more:hover { background: var(--bg-active); color: var(--text-primary); }
        .channel-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: var(--radius-sm);
          cursor: pointer; transition: all 0.2s var(--ease-smooth);
          text-decoration: none; color: var(--text-secondary);
          position: relative; animation: fadeIn 0.35s var(--ease-smooth) backwards;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .channel-item:hover {
          background: var(--bg-hover); color: var(--text-primary);
          border-color: rgba(168, 85, 247, 0.08);
          transform: translateX(2px);
        }
        .channel-item--active {
          background: rgba(168, 85, 247, 0.08); color: var(--text-primary);
          border-color: rgba(168, 85, 247, 0.15);
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.06);
        }
        .channel-item--leaving { opacity: 0.4; pointer-events: none; }
        .channel-item--voice { border-color: rgba(34, 211, 238, 0.05); }
        .channel-item--voice:hover { background: rgba(34, 211, 238, 0.06); border-color: rgba(34, 211, 238, 0.12); }
        .active-indicator {
          position: absolute; left: -8px; top: 50%; transform: translateY(-50%);
          width: 3px; height: 22px; background: var(--gradient-primary);
          border-radius: 0 4px 4px 0; box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
        }
        .channel-icon {
          width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
          background: rgba(168, 85, 247, 0.08); border-radius: 10px;
          font-size: 14px; flex-shrink: 0; color: var(--text-muted); transition: all 0.2s ease;
        }
        .channel-icon--active {
          background: var(--accent-gold-dim); color: var(--accent-gold);
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.15);
        }
        .channel-icon--voice { background: rgba(34, 211, 238, 0.08); color: var(--accent-cyan); }
        .channel-info { flex: 1; min-width: 0; }
        .channel-name { display: block; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .channel-preview { display: block; font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
        .voice-count { display: block; font-size: 11px; color: var(--accent-cyan); font-weight: 700; margin-top: 2px; }
        .channel-time { font-size: 10px; color: var(--text-muted); flex-shrink: 0; font-weight: 500; }
        .voice-users {
          display: flex; gap: 4px; padding: 4px 14px 6px 52px; flex-wrap: wrap;
        }
        .voice-user { position: relative; width: 22px; height: 22px; }
        .voice-user-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-cyan); }
        .voice-user-fallback {
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--gradient-primary); display: flex; align-items: center;
          justify-content: center; font-size: 9px; font-weight: 700; color: white;
        }
        .voice-muted-dot { position: absolute; bottom: -1px; right: -1px; width: 8px; height: 8px; background: var(--accent-rose); border-radius: 50%; border: 1.5px solid var(--bg-secondary); }
        .no-channels { text-align: center; padding: 28px 16px; color: var(--text-muted); }
        .no-channels p { font-size: 14px; }
        .hint { font-size: 12px !important; margin-top: 4px; color: var(--text-muted); }
        .context-menu { position: fixed; z-index: 100; min-width: 190px; padding: 4px; border-radius: var(--radius); box-shadow: var(--shadow-lg); }
        .context-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 9px 14px; border: none; background: none;
          color: var(--text-secondary); font-size: 13px; font-weight: 600;
          cursor: pointer; border-radius: var(--radius-sm); transition: all 0.15s ease;
        }
        .context-item:hover { background: var(--bg-hover); }
        .context-item--danger:hover { background: rgba(251,113,133,0.08); color: var(--accent-rose); }
        .context-item--disabled { color: var(--text-muted); cursor: default; font-size: 12px; }
        .context-item--disabled:hover { background: none; }
      `}</style>
    </>
  );
}
