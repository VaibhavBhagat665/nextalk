"use client";

import { Rocket } from "lucide-react";

export default function DMWelcomePage() {
  return (
    <div className="welcome">
      <div className="welcome-content animate-fade-in">
        <div className="welcome-icon"><Rocket size={64} /></div>
        <h1 className="gradient-text">Direct Messages</h1>
        <p>Select a conversation from the sidebar or click on a user in a server to start chatting!</p>
      </div>
      <style jsx>{`
        .welcome { flex:1; display:flex; align-items:center; justify-content:center; }
        .welcome-content { text-align:center; max-width: 400px; }
        .welcome-icon { color: var(--accent-gold); opacity: 0.8; margin-bottom:16px; display: flex; justify-content: center; }
        h1 { font-size:28px; margin-bottom:8px; }
        p { color:var(--text-tertiary); font-size:16px; line-height: 1.5; }
      `}</style>
    </div>
  );
}
