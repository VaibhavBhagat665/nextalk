"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Users, MessageSquare, Loader2, Search, LogIn, Hash } from "lucide-react";
import { getChannelIcon } from "@/lib/channel-icons";

interface DiscoverChannel {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  memberCount: number;
  messageCount: number;
}

export default function BrowseChannelsDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [channels, setChannels] = useState<DiscoverChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/channels/discover")
      .then((r) => r.json())
      .then(setChannels)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async (channelId: string) => {
    setJoining(channelId);
    try {
      const res = await fetch("/api/channels/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });

      if (res.ok) {
        router.push(`/channel/${channelId}`);
        router.refresh();
        onClose();
      }
    } catch (err) {
      console.error("Join failed:", err);
    } finally {
      setJoining(null);
    }
  };

  const filtered = channels.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog glass-strong animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Browse Channels</h2>
          <button className="btn-ghost" onClick={onClose} id="close-browse-btn">
            <X size={18} />
          </button>
        </div>

        <div className="search-wrap">
          <Search size={16} />
          <input
            type="text"
            className="input-field"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            id="browse-search"
          />
        </div>

        <div className="channel-results">
          {loading ? (
            <div className="loading-state">
              <Loader2 size={24} className="spin" />
              <p>Finding channels...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Hash size={32} />
              <p>{search ? "No channels match your search" : "No channels to join — you're in all of them!"}</p>
            </div>
          ) : (
            filtered.map((channel) => (
              <div key={channel.id} className="discover-item" id={`discover-${channel.id}`}>
                <div className="discover-icon">
                  {(() => { const Icon = getChannelIcon(channel.icon); return <Icon size={18} />; })()}
                </div>
                <div className="discover-info">
                  <span className="discover-name">{channel.name}</span>
                  {channel.description && (
                    <span className="discover-desc">{channel.description}</span>
                  )}
                  <div className="discover-meta">
                    <span><Users size={12} /> {channel.memberCount} members</span>
                    <span><MessageSquare size={12} /> {channel.messageCount} messages</span>
                  </div>
                </div>
                <button
                  className="btn-primary join-btn"
                  onClick={() => handleJoin(channel.id)}
                  disabled={joining === channel.id}
                >
                  {joining === channel.id ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <><LogIn size={14} /> Join</>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }

        .dialog {
          width: 100%;
          max-width: 500px;
          padding: 24px;
          border-radius: var(--radius-lg);
          max-height: 70vh;
          display: flex;
          flex-direction: column;
        }

        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .dialog-header h2 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }

        .search-wrap :global(svg) {
          position: absolute;
          left: 12px;
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .search-wrap .input-field {
          padding-left: 36px;
          width: 100%;
        }

        .channel-results {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .loading-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 0;
          color: var(--text-tertiary);
          text-align: center;
        }

        .empty-state p {
          font-size: 14px;
        }

        .discover-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-primary);
          transition: all 0.15s ease;
        }

        .discover-item:hover {
          background: var(--bg-hover);
          border-color: var(--border-secondary);
        }

        .discover-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          border-radius: 10px;
          color: var(--text-tertiary);
          flex-shrink: 0;
        }

        .discover-info {
          flex: 1;
          min-width: 0;
        }

        .discover-name {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .discover-desc {
          display: block;
          font-size: 12px;
          color: var(--text-tertiary);
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .discover-meta {
          display: flex;
          gap: 12px;
          margin-top: 4px;
        }

        .discover-meta span {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--text-muted);
        }

        .join-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px !important;
          font-size: 13px !important;
          flex-shrink: 0;
        }

        :global(.spin) {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
