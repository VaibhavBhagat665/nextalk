"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Loader2, Globe, Link2 } from "lucide-react";

const SERVER_ICONS = ["🎮", "💻", "🎵", "📚", "🏢", "🚀", "⚡", "🌟", "🎯", "🔥", "💬", "🛠️"];

export default function CreateServerDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💬");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create server");
      }
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/servers/join/${inviteCode.trim()}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join server");
      }
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-card animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close btn-ghost" onClick={onClose} id="close-server-dialog">
          <X size={16} />
        </button>

        {mode === "choose" && (
          <div className="choose-mode">
            <h2>Add a Server</h2>
            <p className="subtitle">Create your own or join an existing one</p>

            <button className="mode-card" onClick={() => setMode("create")} id="create-server-option">
              <div className="mode-icon create-icon">
                <Plus size={24} />
              </div>
              <div className="mode-info">
                <h3>Create a Server</h3>
                <p>Start fresh with your own channels and members</p>
              </div>
            </button>

            <button className="mode-card" onClick={() => setMode("join")} id="join-server-option">
              <div className="mode-icon join-icon">
                <Globe size={24} />
              </div>
              <div className="mode-info">
                <h3>Join a Server</h3>
                <p>Enter an invite code to join an existing server</p>
              </div>
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="create-form">
            <h2>Create Server</h2>
            <p className="subtitle">Give your server a name and icon</p>

            <div className="icon-picker">
              <div className="selected-icon">{icon}</div>
              <div className="icon-grid">
                {SERVER_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    className={`icon-option ${icon === emoji ? "icon-option--active" : ""}`}
                    onClick={() => setIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <label className="field-label">Server Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="My Awesome Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              autoFocus
              id="server-name-input"
            />

            {error && <div className="error-msg">{error}</div>}

            <div className="form-actions">
              <button className="btn-ghost" onClick={() => setMode("choose")}>Back</button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                id="create-server-submit"
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                Create Server
              </button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className="join-form">
            <h2>Join Server</h2>
            <p className="subtitle">Enter an invite code from a friend</p>

            <label className="field-label">
              <Link2 size={12} />
              Invite Code
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Paste invite code here..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoFocus
              id="invite-code-input"
            />

            {error && <div className="error-msg">{error}</div>}

            <div className="form-actions">
              <button className="btn-ghost" onClick={() => setMode("choose")}>Back</button>
              <button
                className="btn-primary"
                onClick={handleJoin}
                disabled={loading || !inviteCode.trim()}
                id="join-server-submit"
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Globe size={14} />}
                Join Server
              </button>
            </div>
          </div>
        )}

        <style jsx>{`
          .dialog-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(6px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 200;
          }

          .dialog-card {
            width: 420px;
            max-width: 92vw;
            background: var(--bg-secondary);
            border: 1px solid var(--border-primary);
            border-radius: var(--radius-xl);
            padding: 32px;
            position: relative;
            box-shadow: var(--shadow-lg);
          }

          .dialog-close {
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px !important;
            color: var(--text-muted) !important;
          }

          h2 {
            font-family: "Fredoka", "Comic Neue", sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 4px;
          }

          .subtitle {
            font-size: 13px;
            color: var(--text-muted);
            margin-bottom: 24px;
          }

          .mode-card {
            display: flex;
            align-items: center;
            gap: 16px;
            width: 100%;
            padding: 16px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-primary);
            border-radius: var(--radius);
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: left;
            margin-bottom: 12px;
            color: var(--text-primary);
          }

          .mode-card:hover {
            border-color: var(--border-glow);
            background: var(--bg-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-card);
          }

          .mode-icon {
            width: 48px;
            height: 48px;
            border-radius: var(--radius);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .create-icon {
            background: var(--accent-gold-dim);
            color: var(--accent-gold);
          }

          .join-icon {
            background: rgba(91, 184, 212, 0.1);
            color: var(--accent-cyan);
          }

          .mode-info h3 {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 2px;
          }

          .mode-info p {
            font-size: 12px;
            color: var(--text-muted);
          }

          .icon-picker {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 20px;
          }

          .selected-icon {
            width: 64px;
            height: 64px;
            border-radius: var(--radius-lg);
            background: var(--bg-tertiary);
            border: 2px solid var(--border-glow);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            flex-shrink: 0;
          }

          .icon-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }

          .icon-option {
            width: 36px;
            height: 36px;
            border: 1px solid transparent;
            border-radius: var(--radius-sm);
            background: var(--bg-tertiary);
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
          }

          .icon-option:hover {
            background: var(--bg-hover);
            border-color: var(--border-primary);
            transform: scale(1.1);
          }

          .icon-option--active {
            border-color: var(--accent-gold);
            background: var(--accent-gold-dim);
          }

          .field-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
            margin-bottom: 8px;
          }

          .error-msg {
            color: var(--accent-rose);
            font-size: 13px;
            margin-top: 8px;
            padding: 8px 12px;
            background: rgba(224, 107, 122, 0.08);
            border-radius: var(--radius-sm);
            border: 1px solid rgba(224, 107, 122, 0.15);
          }

          .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 20px;
          }

          .form-actions .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </div>
  );
}
