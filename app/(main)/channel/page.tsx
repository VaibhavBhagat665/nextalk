"use client";

import { Hash, Plus, Compass, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import CreateChannelDialog from "@/components/sidebar/CreateChannelDialog";
import JoinChannelDialog from "@/components/sidebar/JoinChannelDialog"; // I will create this

export default function EmptyChannelPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  return (
    <div className="empty-channel-page glass-strong">
      <div className="empty-content animate-fade-in">
        <div className="empty-icon-wrap gold-shimmer">
          <Hash size={48} className="empty-icon" />
        </div>
        
        <h1 className="empty-title">Welcome to NexTalk</h1>
        <p className="empty-desc">
          You don't have any channels yet. Create a new channel or join an existing one to start chatting.
        </p>

        <div className="empty-actions">
          <button className="action-card" onClick={() => setShowCreate(true)} id="empty-create-btn">
            <div className="action-icon">
              <Plus size={20} />
            </div>
            <div className="action-text">
              <h3>Create Channel</h3>
              <p>Start a new community</p>
            </div>
          </button>

          <button className="action-card" onClick={() => setShowJoin(true)} id="empty-join-btn">
            <div className="action-icon">
              <LinkIcon size={20} />
            </div>
            <div className="action-text">
              <h3>Join with Invite</h3>
              <p>Have an invite link? Join here</p>
            </div>
          </button>
        </div>
      </div>

      {showCreate && <CreateChannelDialog onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinChannelDialog onClose={() => setShowJoin(false)} />}

      <style jsx>{`
        .empty-channel-page {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .empty-content {
          max-width: 500px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .empty-icon-wrap {
          width: 96px;
          height: 96px;
          background: var(--bg-tertiary);
          border-radius: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-glow);
        }

        .empty-icon {
          color: var(--accent-gold);
        }

        .empty-title {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 32px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          margin-bottom: 12px;
        }

        .empty-desc {
          font-size: 16px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 40px;
        }

        .empty-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          width: 100%;
        }

        .action-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 24px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.25s var(--ease-smooth);
        }

        .action-card:hover {
          background: var(--bg-hover);
          border-color: var(--accent-gold-dim);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .action-icon {
          width: 48px;
          height: 48px;
          background: var(--bg-elevated);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          transition: all 0.25s ease;
        }

        .action-card:hover .action-icon {
          background: var(--accent-gold-dim);
          color: var(--accent-gold);
        }

        .action-text h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .action-text p {
          font-size: 13px;
          color: var(--text-tertiary);
        }

        @media (max-width: 600px) {
          .empty-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
