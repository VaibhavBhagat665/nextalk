"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, X, Loader2 } from "lucide-react";

export default function JoinChannelDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    // Extract code if it's a full URL
    let code = inviteCode.trim();
    if (code.includes("/invite/")) {
      code = code.split("/invite/")[1].split("/")[0];
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/invite/${code}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join channel");
        return;
      }

      router.push(`/channel/${data.channel.id}`);
      router.refresh();
      onClose();
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog glass-strong animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-header-left">
            <div className="dialog-icon">
              <LinkIcon size={16} />
            </div>
            <h2>Join Channel</h2>
          </div>
          <button className="btn-ghost close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="divider-glow" />

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="invite-code">Invite Link or Code</label>
            <div className="input-with-icon">
              <LinkIcon size={16} />
              <input
                id="invite-code"
                type="text"
                className="input-field"
                placeholder="e.g. https://nextalk.com/invite/abc12345 or abc12345"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-gold"
              disabled={!inviteCode.trim() || loading}
            >
              {loading ? <Loader2 size={16} className="spin" /> : "Join Channel"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }

        .dialog {
          width: 100%;
          max-width: 460px;
          padding: 0;
          border-radius: var(--radius-xl);
          overflow: hidden;
        }

        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
        }

        .dialog-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .dialog-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-gold-dim);
          border-radius: 9px;
          color: var(--accent-gold);
        }

        .dialog-header h2 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
        }

        .close-btn {
          padding: 6px !important;
          color: var(--text-muted) !important;
        }

        form {
          padding: 18px 22px 22px;
        }

        .form-group {
          margin-bottom: 18px;
        }

        .form-group label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-icon :global(svg) {
          position: absolute;
          left: 12px;
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .input-with-icon .input-field {
          padding-left: 38px;
        }

        .error-message {
          padding: 10px 14px;
          background: rgba(244, 63, 94, 0.08);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: var(--radius-sm);
          color: var(--accent-rose);
          font-size: 13px;
          margin-bottom: 16px;
        }

        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
