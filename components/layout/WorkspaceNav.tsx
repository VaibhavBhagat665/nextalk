"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { MessageSquare, Settings, Plus, Copy, Check } from "lucide-react";
import CreateServerDialog from "@/components/modals/CreateServerDialog";

interface User {
  id: string;
  username: string;
  imageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface ServerInfo {
  id: string;
  name: string;
  icon: string | null;
  role: string;
  isOwner: boolean;
  inviteCode?: string;
}

export default function WorkspaceNav({
  currentUser,
  servers = [],
  activeServerId,
}: {
  currentUser: User;
  servers?: ServerInfo[];
  activeServerId?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleServerClick = (serverId: string) => {
    router.push(`/channel?server=${serverId}`);
  };

  const copyInvite = (e: React.MouseEvent, code: string, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <nav className="workspace-nav">
      <Link href="/channel" className="nav-logo" id="nav-logo" data-tooltip-right="Home">
        <MessageSquare size={18} />
      </Link>

      <div className="nav-divider" />

      <div className="server-list">
        {servers.map((server) => {
          const isActive = activeServerId === server.id;
          return (
            <div key={server.id} className="server-item-wrap">
              <button
                className={`server-icon ${isActive ? "server-icon--active" : ""}`}
                onClick={() => handleServerClick(server.id)}
                data-tooltip-right={server.name}
                id={`server-${server.id}`}
              >
                {isActive && <div className="active-pill" />}
                {server.icon ? (
                  <span className="server-emoji">{server.icon}</span>
                ) : (
                  <span className="server-letter">{server.name[0].toUpperCase()}</span>
                )}
              </button>
              {isActive && server.inviteCode && (
                <button
                  className="invite-copy-mini"
                  onClick={(e) => copyInvite(e, server.inviteCode!, server.id)}
                  data-tooltip-right={copiedId === server.id ? "Copied!" : "Copy invite"}
                >
                  {copiedId === server.id ? <Check size={10} /> : <Copy size={10} />}
                </button>
              )}
            </div>
          );
        })}

        <button
          className="server-icon server-icon--add"
          onClick={() => setShowCreateServer(true)}
          data-tooltip-right="Add a Server"
          id="add-server-btn"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="nav-bottom">
        <Link
          href="/settings"
          className={`nav-btn ${pathname === "/settings" ? "nav-btn--active" : ""}`}
          data-tooltip-right="Settings"
          id="nav-settings"
        >
          <Settings size={18} />
        </Link>

        <div className="nav-user" onClick={() => setShowUserMenu(!showUserMenu)}>
          {currentUser.imageUrl ? (
            <Image
              src={currentUser.imageUrl}
              alt={currentUser.username}
              width={34}
              height={34}
              className="nav-avatar-img"
            />
          ) : (
            <div className="nav-avatar-fallback">
              {(currentUser.firstName?.[0] || currentUser.username[0]).toUpperCase()}
            </div>
          )}
          <div className="presence-dot" />
        </div>

        {showUserMenu && (
          <div className="user-popup glass-strong animate-scale-in">
            <UserButton afterSignOutUrl="/" />
          </div>
        )}
      </div>

      {showCreateServer && (
        <CreateServerDialog onClose={() => setShowCreateServer(false)} />
      )}

      <style jsx>{`
        .workspace-nav {
          width: 62px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: var(--bg-secondary);
          padding: 14px 0;
          gap: 4px;
          flex-shrink: 0;
          z-index: 50;
        }
        .nav-logo {
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          background: var(--gradient-primary);
          border-radius: 14px; color: white;
          text-decoration: none;
          transition: all 0.3s var(--ease-smooth);
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
        }
        .nav-logo:hover {
          border-radius: 12px; transform: scale(1.08);
          box-shadow: var(--shadow-glow);
        }
        .nav-divider {
          width: 26px; height: 2px;
          background: var(--gradient-divider);
          margin: 6px 0; flex-shrink: 0;
          border-radius: 1px;
        }
        .server-list {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; gap: 6px;
          overflow-y: auto; overflow-x: hidden;
          padding: 2px 0; width: 100%;
        }
        .server-list::-webkit-scrollbar { width: 0; }
        .server-item-wrap { position: relative; display: flex; flex-direction: column; align-items: center; }
        .server-icon {
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%; background: var(--bg-tertiary);
          border: 2px solid transparent; cursor: pointer;
          transition: all 0.3s var(--ease-smooth);
          position: relative; text-decoration: none;
          color: var(--text-secondary); flex-shrink: 0;
        }
        .server-icon:hover {
          border-radius: 14px;
          background: var(--accent-gold-dim);
          color: var(--accent-gold);
          border-color: var(--accent-gold);
          transform: translateY(-1px);
        }
        .server-icon--active {
          border-radius: 14px;
          background: var(--accent-gold-dim);
          color: var(--accent-gold);
          border-color: rgba(168, 85, 247, 0.3);
        }
        .active-pill {
          position: absolute; left: -9px; top: 50%;
          transform: translateY(-50%);
          width: 4px; height: 22px;
          background: var(--gradient-primary);
          border-radius: 0 4px 4px 0;
          animation: fadeIn 0.2s ease;
        }
        .server-emoji { font-size: 18px; line-height: 1; }
        .server-letter {
          font-family: "Bubblegum Sans", cursive;
          font-size: 16px; font-weight: 400;
        }
        .server-icon--add {
          background: transparent;
          border: 2px dashed var(--border-primary);
          color: var(--text-muted);
        }
        .server-icon--add:hover {
          border-style: solid;
          border-color: var(--accent-emerald);
          background: rgba(52, 211, 153, 0.08);
          color: var(--accent-emerald);
        }
        .invite-copy-mini {
          margin-top: 2px;
          width: 18px; height: 18px;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: 6px; cursor: pointer;
          color: var(--text-muted); font-size: 10px;
          transition: all 0.2s ease;
        }
        .invite-copy-mini:hover {
          background: var(--accent-gold-dim);
          color: var(--accent-gold);
          border-color: var(--accent-gold);
        }
        .nav-bottom {
          display: flex; flex-direction: column;
          align-items: center; gap: 6px;
          padding-top: 8px;
          border-top: 1px solid var(--border-secondary);
          margin-top: auto; position: relative;
        }
        .nav-btn {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 12px; color: var(--text-muted);
          text-decoration: none; transition: all 0.2s ease;
        }
        .nav-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .nav-btn--active { color: var(--accent-gold); background: var(--accent-gold-dim); }
        .nav-user {
          width: 34px; height: 34px; cursor: pointer;
          position: relative; border-radius: 50%;
          transition: transform 0.2s var(--ease-smooth);
        }
        .nav-user:hover { transform: scale(1.1); }
        .nav-user :global(.nav-avatar-img) {
          border-radius: 50%; width: 34px; height: 34px; object-fit: cover;
        }
        .nav-avatar-fallback {
          width: 34px; height: 34px; border-radius: 50%;
          background: var(--gradient-primary);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: white;
          font-family: "Bubblegum Sans", cursive;
        }
        .presence-dot {
          position: absolute; bottom: -1px; right: -1px;
          width: 11px; height: 11px;
          background: var(--accent-emerald); border-radius: 50%;
          border: 2.5px solid var(--bg-secondary);
        }
        .user-popup {
          position: absolute; bottom: 46px; left: 50%;
          transform: translateX(-50%);
          padding: 8px; border-radius: var(--radius-lg); z-index: 100;
        }
        @media (max-width: 768px) {
          .workspace-nav { display: none; }
        }
      `}</style>
    </nav>
  );
}
