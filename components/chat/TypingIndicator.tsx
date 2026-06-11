"use client";

interface TypingUser {
  userId: string;
  username: string;
}

/**
 * TypingIndicator — Premium animated typing indicator with gold dots
 * and smoother spring curves. Shows contextual user names.
 */
export default function TypingIndicator({ typingUsers }: { typingUsers: TypingUser[] }) {
  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0].username} is typing`
      : typingUsers.length === 2
        ? `${typingUsers[0].username} and ${typingUsers[1].username} are typing`
        : `${typingUsers[0].username} and ${typingUsers.length - 1} others are typing`;

  return (
    <div className="typing-indicator animate-fade-in">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-text">{text}</span>
      <style jsx>{`
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 24px 2px;
          height: 24px;
        }
        .typing-dots {
          display: flex;
          gap: 3px;
        }
        .typing-text {
          font-size: 12px;
          color: var(--text-tertiary);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
