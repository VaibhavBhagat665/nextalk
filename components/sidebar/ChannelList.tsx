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
  description?: string | null;
  isPrivate?: boolean;
  isDM?: boolean;
  lastMessage?: { content: string; createdAt: string } | null;
  role?: string;
  voiceUsers?: { id: string; username: string; imageUrl: string | null; muted: boolean }[];
  targetUserId?: string;
  isOnline?: boolean;
  unreadCount?: number;
  mentionCount?: number;
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
      {/* Context menu backdrop */}
      {contextMenu && (
        <div 
          className="fixed inset-0 z-[90]" 
          onClick={closeContextMenu} 
        />
      )}

      {/* Channel list */}
      <nav className="flex flex-col gap-[3px] px-2">
        {channels.map((channel, index) => {
          const isActive = currentPath === `/channel/${channel.id}`;
          const Icon = isVoice ? Volume2 : getChannelIcon(channel.icon);
          const voiceUsers = channel.voiceUsers || [];
          const href = currentServerId ? `/channel/${channel.id}?server=${currentServerId}` : `/channel/${channel.id}`;
          const unreadCount = channel.unreadCount || 0;
          const mentionCount = channel.mentionCount || 0;

          return (
            <div 
              key={channel.id} 
              className="relative group" 
              onContextMenu={(e) => handleContextMenu(e, channel.id)}
            >
              <Link
                href={href}
                id={`channel-${channel.id}`}
                style={{ animationDelay: `${index * 40}ms` }}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-[10px]
                  cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]
                  no-underline relative
                  bg-white/[0.02] border border-white/[0.03]
                  animate-[fadeIn_0.35s_cubic-bezier(0.25,0.1,0.25,1)_backwards]
                  ${isActive 
                    ? 'bg-purple-500/[0.08] text-[var(--text-primary)] border-purple-500/[0.15] shadow-[0_0_12px_rgba(168,85,247,0.06)]' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] hover:border-purple-500/[0.08] hover:translate-x-[2px]'
                  }
                  ${leaving === channel.id ? 'opacity-40 pointer-events-none' : ''}
                  ${isVoice ? 'border-cyan-500/[0.05] hover:bg-cyan-500/[0.06] hover:border-cyan-500/[0.12]' : ''}
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-[3px] h-[22px] bg-[var(--gradient-primary)] rounded-r-[4px] shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                )}

                {/* Channel icon */}
                <div className={`
                  w-[30px] h-[30px] flex items-center justify-center
                  rounded-[10px] text-sm flex-shrink-0 transition-all duration-200
                  ${isActive 
                    ? 'bg-[var(--accent-gold-dim)] text-[var(--accent-gold)] shadow-[0_0_12px_rgba(168,85,247,0.15)]' 
                    : isVoice 
                      ? 'bg-cyan-500/[0.08] text-[var(--accent-cyan)]' 
                      : 'bg-purple-500/[0.08] text-[var(--text-muted)]'
                  }
                `}>
                  {channel.isPrivate ? <Lock size={15} /> : <Icon size={15} />}
                </div>

                {/* Channel info */}
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                    {channel.name}
                  </span>
                  {!isVoice && channel.lastMessage && (
                    <span className="block text-xs text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap mt-0.5">
                      {channel.lastMessage.content.length > 30
                        ? channel.lastMessage.content.slice(0, 30) + "..."
                        : channel.lastMessage.content}
                    </span>
                  )}
                  {isVoice && voiceUsers.length > 0 && (
                    <span className="block text-[11px] text-[var(--accent-cyan)] font-bold mt-0.5">
                      {voiceUsers.length} connected
                    </span>
                  )}
                </div>

                {/* Unread & Mention Badges */}
                {!isActive && (
                  <div className="flex items-center gap-1 mr-1">
                    {mentionCount > 0 && (
                      <div className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full animate-[pulse_2s_ease-in-out_infinite]">
                        {mentionCount > 99 ? "99+" : mentionCount}
                      </div>
                    )}
                    {unreadCount > 0 && mentionCount === 0 && (
                      <div className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-[var(--text-muted)] text-[var(--bg-secondary)] text-[10px] font-bold rounded-full">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                {!isVoice && channel.lastMessage && (
                  <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 font-medium">
                    {formatRelativeTime(channel.lastMessage.createdAt)}
                  </span>
                )}
              </Link>

              {/* Voice users avatars */}
              {isVoice && voiceUsers.length > 0 && (
                <div className="flex gap-1 px-[14px] py-1 pl-[52px] flex-wrap">
                  {voiceUsers.map((u) => (
                    <div key={u.id} className="relative w-[22px] h-[22px]" data-tooltip={u.username}>
                      {u.imageUrl ? (
                        <img 
                          src={u.imageUrl} 
                          alt={u.username} 
                          className="w-[22px] h-[22px] rounded-full object-cover border-2 border-[var(--accent-cyan)]" 
                        />
                      ) : (
                        <div className="w-[22px] h-[22px] rounded-full bg-[var(--gradient-primary)] flex items-center justify-center text-[9px] font-bold text-white">
                          {u.username[0].toUpperCase()}
                        </div>
                      )}
                      {u.muted && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[var(--accent-rose)] rounded-full border-[1.5px] border-[var(--bg-secondary)]" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* More button */}
              <button 
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none text-[var(--text-muted)] p-1 rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-all duration-200 z-[2] flex items-center justify-center"
                onClick={(e) => handleContextMenu(e, channel.id)} 
                id={`channel-more-${channel.id}`}
              >
                <MoreVertical size={14} />
              </button>
            </div>
          );
        })}

        {/* Empty state */}
        {channels.length === 0 && (
          <div className="text-center py-7 px-4 text-[var(--text-muted)]">
            <p className="text-sm">No channels yet</p>
            <p className="text-xs mt-1 text-[var(--text-muted)]">Create one to get started!</p>
          </div>
        )}
      </nav>

      {/* Context menu */}
      {contextMenu && (() => {
        const channel = channels.find((c) => c.id === contextMenu.channelId);
        const isGeneral = channel?.name === "general";
        return (
          <div 
            className="fixed z-[100] min-w-[190px] p-1 rounded-[14px] shadow-[var(--shadow-lg)] backdrop-blur-xl bg-[var(--bg-elevated)]/95 border border-white/10 animate-[fadeIn_0.15s_ease]" 
            style={{ top: contextMenu.y, left: contextMenu.x }} 
            id="channel-context-menu"
          >
            {!isGeneral && (
              <button 
                className="flex items-center gap-2 w-full px-3.5 py-2 border-none bg-none text-[var(--text-secondary)] text-[13px] font-semibold cursor-pointer rounded-[10px] transition-all duration-150 hover:bg-[var(--bg-hover)] hover:bg-rose-500/[0.08] hover:text-[var(--accent-rose)]" 
                onClick={() => handleLeave(contextMenu.channelId)} 
                id="leave-channel-btn"
              >
                <LogOut size={14} />
                <span>Leave Channel</span>
              </button>
            )}
            {channel?.role === "admin" && !isGeneral && (
              <button 
                className="flex items-center gap-2 w-full px-3.5 py-2 border-none bg-none text-[var(--text-secondary)] text-[13px] font-semibold cursor-pointer rounded-[10px] transition-all duration-150 hover:bg-[var(--bg-hover)] hover:bg-rose-500/[0.08] hover:text-[var(--accent-rose)]" 
                onClick={async () => {
                  closeContextMenu();
                  if (confirm(`Delete #${channel.name}? This cannot be undone.`)) {
                    await fetch(`/api/channels/${channel.id}`, { method: "DELETE" });
                    router.push("/channel"); 
                    router.refresh();
                  }
                }} 
                id="delete-channel-btn"
              >
                <Trash2 size={14} />
                <span>Delete Channel</span>
              </button>
            )}
            {isGeneral && (
              <div className="text-[var(--text-muted)] cursor-default text-xs px-3.5 py-2">
                <span>Cannot leave #general</span>
              </div>
            )}
          </div>
        );
      })()}
    </>
  );
}
