"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, X, Loader2, Hash, Volume2 } from "lucide-react";
import { CHANNEL_ICONS, getChannelIcon } from "@/lib/channel-icons";

/**
 * CreateChannelDialog — Premium modal for creating new channels.
 * Features icon picker, private toggle, and gold-accent create button.
 * Theme-aware styling via CSS variables.
 */
export default function CreateChannelDialog({
  onClose,
  serverId,
}: {
  onClose: () => void;
  serverId?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [channelType, setChannelType] = useState<"text" | "voice">("text");
  const [selectedIcon, setSelectedIcon] = useState("#");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isPrivate, icon: selectedIcon, type: channelType, serverId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create channel");
        return;
      }

      const channel = await res.json();
      onClose();
      // Refresh first so layout re-fetches sidebar data, then navigate
      router.refresh();
      // Small delay to let the refresh propagate before navigation
      await new Promise((r) => setTimeout(r, 150));
      router.push(`/channel/${channel.id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const SelectedIconComponent = getChannelIcon(selectedIcon);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog glass-strong animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-header-left">
            <div className="dialog-icon">
              {isPrivate ? <Lock size={16} /> : <SelectedIconComponent size={16} />}
            </div>
            <h2>Create Channel</h2>
          </div>
          <button className="btn-ghost close-btn" onClick={onClose} id="close-dialog-btn">
            <X size={18} />
          </button>
        </div>

        <div className="divider-glow" />

        <form onSubmit={handleSubmit}>
          {/* Channel Type Toggle */}
          <div className="form-group">
            <label>Channel type</label>
            <div className="type-picker">
              <button type="button" className={`type-option ${channelType === "text" ? "type-option--active" : ""}`}
                onClick={() => setChannelType("text")}>
                <Hash size={16} /><span>Text</span>
              </button>
              <button type="button" className={`type-option ${channelType === "voice" ? "type-option--active" : ""}`}
                onClick={() => setChannelType("voice")}>
                <Volume2 size={16} /><span>Voice</span>
              </button>
            </div>
          </div>

          {/* Channel Name */}
          <div className="form-group">
            <label htmlFor="channel-name">Channel name</label>
            <div className="input-with-icon">
              {isPrivate ? <Lock size={16} /> : <SelectedIconComponent size={16} />}
              <input
                id="channel-name"
                type="text"
                className="input-field"
                placeholder="e.g. design-team"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                autoFocus
                maxLength={50}
              />
            </div>
          </div>

          {/* Icon Picker */}
          {!isPrivate && (
            <div className="form-group">
              <label>Channel icon</label>
              <div className="icon-picker">
                {CHANNEL_ICONS.map((opt) => {
                  const IconComp = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`icon-option ${selectedIcon === opt.id ? "icon-option--active" : ""}`}
                      onClick={() => setSelectedIcon(opt.id)}
                      title={opt.label}
                      id={`icon-${opt.id}`}
                    >
                      <IconComp size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="form-group">
            <label htmlFor="channel-desc">Description (optional)</label>
            <input
              id="channel-desc"
              type="text"
              className="input-field"
              placeholder="What's this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Private Toggle */}
          <div className="form-group toggle-group">
            <div>
              <span className="toggle-label">Private channel</span>
              <span className="toggle-desc">Only invited members can see this channel</span>
            </div>
            <button
              type="button"
              className={`toggle ${isPrivate ? "toggle--active" : ""}`}
              onClick={() => setIsPrivate(!isPrivate)}
              id="private-toggle"
            >
              <div className="toggle-knob" />
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-gold"
              disabled={!name.trim() || loading}
              id="create-channel-submit"
            >
              {loading ? <Loader2 size={16} className="spin" /> : "Create Channel"}
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
          font-family: "Bubblegum Sans", cursive;
          font-size: 20px;
          font-weight: 400;
          color: var(--text-primary);
        }

        .type-picker {
          display: flex; gap: 8px;
        }
        .type-option {
          flex: 1; display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 10px; background: var(--bg-tertiary);
          border: 2px solid var(--border-primary); border-radius: var(--radius-sm);
          color: var(--text-secondary); font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.2s var(--ease-smooth);
        }
        .type-option:hover { border-color: var(--accent-gold); color: var(--text-primary); }
        .type-option--active {
          background: var(--accent-gold-dim); border-color: var(--accent-gold);
          color: var(--accent-gold);
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

        /* Icon Picker Grid */
        .icon-picker {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 5px;
        }

        .icon-option {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: 9px;
          cursor: pointer;
          color: var(--text-tertiary);
          transition: all 0.2s var(--ease-smooth);
        }

        .icon-option:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-secondary);
          transform: scale(1.08);
        }

        .icon-option--active {
          background: var(--accent-gold-dim);
          border-color: var(--accent-gold);
          color: var(--accent-gold);
          box-shadow: 0 0 0 2px rgba(212, 162, 60, 0.12);
        }

        /* Toggle */
        .toggle-group {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 0;
          border-top: 1px solid var(--border-primary);
        }

        .toggle-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .toggle-desc {
          display: block;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 3px;
        }

        .toggle {
          width: 44px;
          height: 24px;
          border-radius: 12px;
          border: none;
          background: var(--bg-tertiary);
          cursor: pointer;
          position: relative;
          transition: background 0.25s var(--ease-smooth);
          flex-shrink: 0;
        }

        .toggle--active {
          background: var(--accent-gold);
        }

        .toggle-knob {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 3px;
          left: 3px;
          transition: transform 0.25s var(--ease-spring);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .toggle--active .toggle-knob {
          transform: translateX(20px);
        }

        /* Error */
        .error-message {
          padding: 10px 14px;
          background: rgba(244, 63, 94, 0.08);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: var(--radius-sm);
          color: var(--accent-rose);
          font-size: 13px;
          margin-bottom: 16px;
        }

        /* Actions */
        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }

        .dialog-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
