"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { Hash, Users, Loader2 } from "lucide-react";

interface InviteInfo {
  channel: {
    id: string;
    name: string;
    description: string | null;
    icon: string;
    memberCount: number;
  };
  creator: {
    username: string;
    imageUrl: string | null;
  };
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const code = params.code as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invalid or expired invite link");
        return res.json();
      })
      .then((data) => setInvite(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!isLoaded) return;
    if (!user) {
      // Redirect to sign in, preserving the returnUrl
      router.push(`/sign-in?redirect_url=/invite/${code}`);
      return;
    }

    setJoining(true);
    setError("");

    try {
      const res = await fetch(`/api/invite/${code}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to join");
      }

      router.push(`/channel/${data.channel.id}`);
    } catch (err: any) {
      setError(err.message);
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="invite-layout">
        <Loader2 size={32} className="spin text-gold" />
      </div>
    );
  }

  return (
    <div className="invite-layout">
      {/* Background mesh */}
      <div className="mesh-bg" />

      <div className="invite-card glass-strong animate-fade-in">
        {error ? (
          <div className="error-state">
            <div className="error-icon">
              <Hash size={32} />
            </div>
            <h2>Invite Invalid</h2>
            <p>{error}</p>
            <button className="btn-ghost" onClick={() => router.push("/")}>
              Return to Home
            </button>
          </div>
        ) : invite ? (
          <div className="invite-content">
            <div className="invite-header">
              {invite.creator.imageUrl ? (
                <Image
                  src={invite.creator.imageUrl}
                  alt={invite.creator.username}
                  width={48}
                  height={48}
                  className="creator-avatar"
                />
              ) : (
                <div className="creator-avatar-fallback">
                  {invite.creator.username[0].toUpperCase()}
                </div>
              )}
              <p className="invite-subtitle">
                <strong>{invite.creator.username}</strong> invited you to join
              </p>
            </div>

            <div className="channel-preview card">
              <div className="channel-icon-wrap">
                <Hash size={24} />
              </div>
              <h1 className="channel-name">{invite.channel.name}</h1>
              {invite.channel.description && (
                <p className="channel-desc">{invite.channel.description}</p>
              )}
              
              <div className="channel-stats">
                <Users size={14} />
                <span>{invite.channel.memberCount} Members</span>
              </div>
            </div>

            <button
              className="btn-gold join-btn"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? <Loader2 size={16} className="spin" /> : (user ? "Accept Invite" : "Login to Join")}
            </button>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .invite-layout {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .mesh-bg {
          position: absolute;
          inset: 0;
          background: var(--gradient-mesh);
          opacity: 0.5;
          z-index: 0;
        }

        .invite-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          padding: 32px;
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-glow);
          box-shadow: var(--shadow-glow);
        }

        .text-gold {
          color: var(--accent-gold);
        }

        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
        }

        .error-icon {
          width: 64px;
          height: 64px;
          background: rgba(244, 63, 94, 0.1);
          color: var(--accent-rose);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .error-state h2 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 24px;
          color: var(--text-primary);
        }

        .error-state p {
          color: var(--text-secondary);
        }

        .invite-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .invite-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .creator-avatar {
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--accent-gold-dim);
        }

        .creator-avatar-fallback {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          color: #1a1400;
        }

        .invite-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .invite-subtitle strong {
          color: var(--text-primary);
        }

        .channel-preview {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px;
          margin-bottom: 24px;
        }

        .channel-icon-wrap {
          width: 48px;
          height: 48px;
          background: var(--accent-gold-dim);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-gold);
          margin-bottom: 12px;
        }

        .channel-name {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .channel-desc {
          font-size: 13px;
          color: var(--text-tertiary);
          margin-bottom: 16px;
        }

        .channel-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-emerald);
          background: rgba(78, 203, 139, 0.1);
          padding: 4px 12px;
          border-radius: 12px;
        }

        .join-btn {
          width: 100%;
          height: 44px;
          font-size: 15px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
