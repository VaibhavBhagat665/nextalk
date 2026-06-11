"use client";

import { MessageSquare } from "lucide-react";

/**
 * AuthLayout — Theme-aware centered layout for sign-in/sign-up pages.
 * Features animated gold orbs, noise texture, and premium card styling.
 * Light: soft linen gradient with brass accent orbs.
 * Dark: deep obsidian gradient with warm gold orbs.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      <div className="auth-bg noise" />
      <div className="auth-dots" />
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />

      <div className="auth-content animate-fade-in">
        {/* Branding */}
        <div className="auth-brand">
          <div className="auth-logo gold-shimmer">
            <MessageSquare size={22} />
          </div>
          <span className="auth-title gradient-text">NexTalk</span>
        </div>

        {/* Clerk form */}
        <div className="auth-card glass-strong">
          {children}
        </div>

        <p className="auth-footer">
          Premium real-time chat for modern teams
        </p>
      </div>

      <style jsx>{`
        .auth-layout {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .auth-bg {
          position: fixed;
          inset: 0;
          background: var(--gradient-mesh);
          z-index: 0;
        }

        /* Subtle dot grid pattern */
        .auth-dots {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background-image: radial-gradient(rgba(197, 165, 90, 0.06) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        [data-theme="light"] .auth-dots {
          background-image: radial-gradient(rgba(158, 124, 58, 0.06) 1px, transparent 1px);
        }

        .auth-orb {
          position: fixed;
          border-radius: 50%;
          z-index: 1;
          pointer-events: none;
        }

        .auth-orb--1 {
          top: 10%;
          left: 5%;
          width: 450px;
          height: 450px;
          background: radial-gradient(circle, rgba(212, 162, 60, 0.08) 0%, transparent 70%);
          animation: float 10s ease-in-out infinite;
        }

        .auth-orb--2 {
          bottom: 10%;
          right: 5%;
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(197, 165, 90, 0.06) 0%, transparent 70%);
          animation: float 10s ease-in-out infinite reverse;
        }

        .auth-orb--3 {
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(212, 162, 60, 0.03) 0%, transparent 60%);
          animation: breathe 6s ease-in-out infinite;
        }

        [data-theme="light"] .auth-orb--1 {
          background: radial-gradient(circle, rgba(158, 124, 58, 0.08) 0%, transparent 70%);
        }

        [data-theme="light"] .auth-orb--2 {
          background: radial-gradient(circle, rgba(139, 110, 53, 0.06) 0%, transparent 70%);
        }

        [data-theme="light"] .auth-orb--3 {
          background: radial-gradient(circle, rgba(158, 124, 58, 0.03) 0%, transparent 60%);
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-30px); }
        }

        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        }

        .auth-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          padding: 20px;
        }

        .auth-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .auth-logo {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gradient-primary);
          border-radius: 14px;
          color: #1a1400;
          box-shadow: var(--shadow-glow);
          transition: all 0.3s var(--ease-spring);
        }

        .auth-logo:hover {
          transform: scale(1.08);
          box-shadow: 0 0 32px rgba(212, 162, 60, 0.3);
        }

        .auth-title {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .auth-card {
          border-radius: var(--radius-xl);
          padding: 8px;
          box-shadow: var(--shadow-lg);
        }

        .auth-footer {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 400;
          letter-spacing: 0.02em;
        }

        @media (max-width: 480px) {
          .auth-title {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
