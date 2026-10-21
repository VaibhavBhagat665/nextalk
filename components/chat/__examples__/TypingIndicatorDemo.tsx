/**
 * TypingIndicator Demo - Visual showcase of the typing indicator component
 * 
 * This demo shows:
 * - Single user typing
 * - Multiple users typing
 * - Auto-hide behavior
 * - Avatar display
 */

"use client";

import { useState } from "react";
import TypingIndicator from "../TypingIndicator";

export default function TypingIndicatorDemo() {
  const [scenario, setScenario] = useState<"none" | "single" | "two" | "multiple">("none");

  const scenarios = {
    none: [],
    single: [
      { userId: "1", username: "Alice Anderson", imageUrl: "https://i.pravatar.cc/150?img=1" }
    ],
    two: [
      { userId: "1", username: "Alice Anderson", imageUrl: "https://i.pravatar.cc/150?img=1" },
      { userId: "2", username: "Bob Builder", imageUrl: "https://i.pravatar.cc/150?img=2" }
    ],
    multiple: [
      { userId: "1", username: "Alice Anderson", imageUrl: "https://i.pravatar.cc/150?img=1" },
      { userId: "2", username: "Bob Builder", imageUrl: "https://i.pravatar.cc/150?img=2" },
      { userId: "3", username: "Charlie Chen", imageUrl: "https://i.pravatar.cc/150?img=3" },
      { userId: "4", username: "Diana Davis", imageUrl: "https://i.pravatar.cc/150?img=4" },
      { userId: "5", username: "Eva Evans", imageUrl: null }
    ]
  };

  return (
    <div className="demo-container">
      <div className="demo-header">
        <h2>Typing Indicator Demo</h2>
        <p>Select a scenario to see the typing indicator in action</p>
      </div>

      <div className="demo-controls">
        <button
          className={`demo-btn ${scenario === "none" ? "active" : ""}`}
          onClick={() => setScenario("none")}
        >
          No one typing
        </button>
        <button
          className={`demo-btn ${scenario === "single" ? "active" : ""}`}
          onClick={() => setScenario("single")}
        >
          1 user typing
        </button>
        <button
          className={`demo-btn ${scenario === "two" ? "active" : ""}`}
          onClick={() => setScenario("two")}
        >
          2 users typing
        </button>
        <button
          className={`demo-btn ${scenario === "multiple" ? "active" : ""}`}
          onClick={() => setScenario("multiple")}
        >
          5 users typing
        </button>
      </div>

      <div className="demo-preview">
        <div className="mock-chat">
          <div className="mock-messages">
            <div className="mock-message">
              <div className="mock-avatar">A</div>
              <div className="mock-content">
                <div className="mock-username">Alice</div>
                <div className="mock-text">Hey everyone! 👋</div>
              </div>
            </div>
            <div className="mock-message">
              <div className="mock-avatar">B</div>
              <div className="mock-content">
                <div className="mock-username">Bob</div>
                <div className="mock-text">Hi Alice!</div>
              </div>
            </div>
          </div>

          {/* Typing Indicator */}
          <TypingIndicator typingUsers={scenarios[scenario]} />

          {/* Mock Input */}
          <div className="mock-input">
            <input type="text" placeholder="Type a message..." disabled />
            <button disabled>Send</button>
          </div>
        </div>

        <div className="demo-info">
          <h3>Features Demonstrated:</h3>
          <ul>
            <li>✅ User avatars (up to 3 visible)</li>
            <li>✅ Remaining count indicator (+N)</li>
            <li>✅ Animated typing dots</li>
            <li>✅ Contextual text</li>
            <li>✅ Auto-hide after 5 seconds</li>
            <li>✅ Fallback initials (see Eva)</li>
          </ul>
          
          {scenario !== "none" && (
            <div className="demo-note">
              💡 <strong>Note:</strong> The indicator will auto-hide after 5 seconds of no changes.
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .demo-container {
          max-width: 1200px;
          margin: 40px auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .demo-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .demo-header h2 {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
        }

        .demo-header p {
          font-size: 14px;
          color: #666;
        }

        .demo-controls {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }

        .demo-btn {
          padding: 10px 20px;
          background: #f5f5f5;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #333;
          transition: all 0.2s ease;
        }

        .demo-btn:hover {
          background: #e8e8e8;
          border-color: #d4a23c;
        }

        .demo-btn.active {
          background: linear-gradient(135deg, #f5d669 0%, #d4a23c 100%);
          border-color: #d4a23c;
          color: #1a1400;
        }

        .demo-preview {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          align-items: start;
        }

        .mock-chat {
          background: #ffffff;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .mock-messages {
          margin-bottom: 16px;
        }

        .mock-message {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .mock-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f5d669 0%, #d4a23c 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #1a1400;
          font-size: 14px;
          flex-shrink: 0;
        }

        .mock-content {
          flex: 1;
        }

        .mock-username {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 4px;
        }

        .mock-text {
          font-size: 14px;
          color: #333;
          line-height: 1.5;
        }

        .mock-input {
          display: flex;
          gap: 8px;
          background: #f8f8f8;
          padding: 12px;
          border-radius: 8px;
          margin-top: 16px;
        }

        .mock-input input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
          background: white;
        }

        .mock-input button {
          padding: 8px 16px;
          background: #d4a23c;
          border: none;
          border-radius: 6px;
          color: #1a1400;
          font-weight: 600;
          cursor: pointer;
          opacity: 0.5;
        }

        .demo-info {
          background: #f8f8f8;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid #e0e0e0;
        }

        .demo-info h3 {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 16px;
        }

        .demo-info ul {
          list-style: none;
          padding: 0;
          margin: 0 0 20px 0;
        }

        .demo-info li {
          padding: 8px 0;
          font-size: 14px;
          color: #333;
          border-bottom: 1px solid #e8e8e8;
        }

        .demo-info li:last-child {
          border-bottom: none;
        }

        .demo-note {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 6px;
          padding: 12px;
          font-size: 13px;
          color: #856404;
        }

        @media (max-width: 768px) {
          .demo-preview {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
