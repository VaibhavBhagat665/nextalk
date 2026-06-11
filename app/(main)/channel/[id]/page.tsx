"use client";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useSocket } from "@/hooks/useSocket";
import { useCall } from "@/hooks/useCall";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import RightPanel from "@/components/layout/RightPanel";
import CallOverlay from "@/components/call/CallOverlay";
import IncomingCallDialog from "@/components/call/IncomingCallDialog";
import VoiceChannelPanel from "@/components/call/VoiceChannelPanel";
import {
  Hash, Users, Loader2, WifiOff, Phone, Video,
  PanelRightOpen, PanelRightClose, ChevronDown,
} from "lucide-react";
import { useParams } from "next/navigation";

interface ChannelInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  type: string;
  members?: { id: string; clerkId: string; username: string; imageUrl: string | null; role: string }[];
  messageCount: number;
}

/**
 * ChannelPage — Main chat interface (Column 3).
 * Cleaned up: spacious header, call buttons wired to useCall hook, less visual noise.
 */
export default function ChannelPage() {
  const params = useParams();
  const channelId = params.id as string;
  const { user } = useUser();
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showCallPicker, setShowCallPicker] = useState<"voice" | "video" | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { messages, setMessages, typingUsers, isConnected, sendMessage, startTyping, reactToMessage } = useSocket(channelId);
  const { callState, initiateCall, acceptCall, declineCall, endCall, toggleMic, toggleVideo } = useCall(user?.id);

  // Fetch channel info
  useEffect(() => {
    fetch(`/api/channels/${channelId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Channel fetch failed: ${r.status}`);
        return r.json();
      })
      .then(setChannel)
      .catch(console.error);
  }, [channelId]);

  // Fetch message history
  useEffect(() => {
    setLoadingHistory(true);
    fetch(`/api/messages?channelId=${channelId}&limit=50`)
      .then((r) => {
        if (!r.ok) throw new Error(`Messages fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setMessages(data.messages.map((m: any) => ({
          id: m.id, content: m.content, userId: m.user.id, username: m.user.username,
          imageUrl: m.user.imageUrl || "", channelId, fileUrl: m.fileUrl, fileName: m.fileName,
          fileType: m.fileType, createdAt: m.createdAt, user: m.user,
          reactions: m.reactions?.map((r: any) => ({ emoji: r.emoji, userId: r.user.id, username: r.user.username })) || [],
        })));
      })
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
  }, [channelId, setMessages]);

  const handleSend = async (content: string, fileUrl?: string, fileName?: string, fileType?: string) => {
    sendMessage(content, fileUrl, fileName, fileType);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, content, fileUrl, fileName, fileType }),
    });
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBtn(distanceFromBottom > 200);
  };

  const scrollToBottom = () => {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  // Handle starting a call — pick target user from members
  const handleCallStart = (type: "voice" | "video") => {
    if (!channel?.members || channel.members.length <= 1) {
      // No other members — just show a message or do nothing
      return;
    }
    setShowCallPicker(type);
  };

  const handlePickUser = (member: { id: string; clerkId: string; username: string; imageUrl: string | null }) => {
    if (!user?.id || member.clerkId === user.id) return;
    initiateCall(
      { userId: member.clerkId, username: member.username, imageUrl: member.imageUrl || "" },
      showCallPicker!
    );
    setShowCallPicker(null);
  };

  return (
    <div className="channel-layout">
      {/* Main chat column */}
      <div className="channel-page">
        {/* Header */}
        <header className="channel-header">
          <div className="header-left">
            <div className="header-icon">
              <Hash size={15} />
            </div>
            <div className="header-info">
              <h1 className="header-name">{channel?.name || "Loading..."}</h1>
              {channel?.description && <p className="header-desc">{channel.description}</p>}
            </div>
          </div>

          <div className="header-right">
            {!isConnected && (
              <div className="offline-badge">
                <WifiOff size={11} />
                <span>Reconnecting</span>
              </div>
            )}

            <button
              className="header-btn"
              onClick={() => handleCallStart("voice")}
              data-tooltip="Voice Call"
              id="voice-call-btn"
            >
              <Phone size={15} />
            </button>
            <button
              className="header-btn"
              onClick={() => handleCallStart("video")}
              data-tooltip="Video Call"
              id="video-call-btn"
            >
              <Video size={15} />
            </button>

            {channel && (
              <div className="member-count" data-tooltip={`${channel.members?.length ?? 0} members`}>
                <Users size={13} />
                <span>{channel.members?.length ?? 0}</span>
              </div>
            )}

            <button
              className={`header-btn ${rightPanelOpen ? "header-btn--active" : ""}`}
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              data-tooltip={rightPanelOpen ? "Close panel" : "Open panel"}
              id="right-panel-toggle"
            >
              {rightPanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            </button>
          </div>
        </header>

        <div className="divider-glow" />

        {/* Call Picker Dropdown */}
        {showCallPicker && channel?.members && (
          <div className="call-picker animate-fade-in">
            <div className="call-picker-header">
              <span>Select who to call ({showCallPicker})</span>
              <button className="btn-ghost" onClick={() => setShowCallPicker(null)}>
                <span style={{ fontSize: 12 }}>Cancel</span>
              </button>
            </div>
            {channel.members
              .filter((m) => m.id !== user?.id)
              .map((member) => (
                <button
                  key={member.id}
                  className="call-picker-item"
                  onClick={() => handlePickUser(member)}
                >
                  <div className="picker-avatar">
                    {member.imageUrl ? (
                      <img src={member.imageUrl} alt={member.username} />
                    ) : (
                      <span>{member.username[0].toUpperCase()}</span>
                    )}
                  </div>
                  <span className="picker-name">{member.username}</span>
                  {showCallPicker === "video" ? <Video size={14} /> : <Phone size={14} />}
                </button>
              ))}
          </div>
        )}

        {/* Main Content Area */}
        {channel?.type === "voice" ? (
          <div className="channel-body voice-mode">
            <VoiceChannelPanel 
              channelId={channelId} 
              currentUserId={user?.id}
              channelName={channel.name}
            />
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="channel-body" ref={scrollContainerRef} onScroll={handleScroll}>
              {loadingHistory ? (
                <div className="loading-state">
                  <div className="skeleton-messages">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="skeleton-msg" style={{ animationDelay: `${i * 80}ms` }}>
                        <div className="skeleton skeleton-avatar" />
                        <div className="skeleton-content">
                          <div className="skeleton skeleton-name" />
                          <div className="skeleton skeleton-text" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <MessageList messages={messages} currentUserId={user?.id || ""} onReact={reactToMessage} />
              )}

              {showScrollBtn && !loadingHistory && (
                <button className="scroll-btn animate-scale-in" onClick={scrollToBottom} id="scroll-bottom">
                  <ChevronDown size={16} />
                </button>
              )}
            </div>

            {/* Input */}
            <TypingIndicator typingUsers={typingUsers} />
            <MessageInput onSend={handleSend} onTyping={startTyping} disabled={!isConnected} />
          </>
        )}

        {/* Call Overlay */}
        {(callState.status === "calling" || callState.status === "connecting" || callState.status === "active") && callState.remoteUser && (
          <CallOverlay
            localStream={callState.localStream}
            remoteStream={callState.remoteStream}
            callStatus={callState.status === "calling" ? "connecting" : callState.status}
            callType={callState.type}
            remoteUser={callState.remoteUser}
            onEndCall={endCall}
            onToggleMic={(enabled) => toggleMic()}
            onToggleVideo={(enabled) => toggleVideo()}
          />
        )}
      </div>

      {/* Column 4 — Right Panel */}
      <RightPanel
        channel={channel ? { ...channel, messageCount: messages.length } : null}
        isOpen={rightPanelOpen}
        onClose={() => setRightPanelOpen(false)}
      />

      {/* Incoming Call Dialog */}
      {callState.status === "ringing" && callState.remoteUser && (
        <IncomingCallDialog
          caller={callState.remoteUser}
          callType={callState.type}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      <style jsx>{`
        .channel-layout {
          display: flex;
          height: 100%;
          overflow: hidden;
        }

        .channel-page {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          position: relative;
          min-width: 0;
        }

        /* Header */
        .channel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: var(--bg-secondary);
          gap: 12px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .header-icon {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-gold-dim);
          border-radius: 8px;
          color: var(--accent-gold);
          flex-shrink: 0;
        }

        .header-name {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-desc {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .header-btn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: var(--text-muted);
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .header-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .header-btn--active {
          color: var(--accent-gold);
          background: var(--accent-gold-dim);
        }

        .offline-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
          background: rgba(224, 107, 122, 0.08);
          color: var(--accent-rose);
          border: 1px solid rgba(224, 107, 122, 0.12);
        }

        .member-count {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-tertiary);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
        }

        /* Call Picker */
        .call-picker {
          position: absolute;
          top: 52px;
          right: 16px;
          width: 260px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius);
          box-shadow: var(--shadow-lg);
          z-index: 30;
          overflow: hidden;
        }

        .call-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--border-secondary);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .call-picker-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          transition: background 0.15s ease;
          font-size: 13px;
          font-family: inherit;
        }

        .call-picker-item:hover {
          background: var(--bg-hover);
        }

        .call-picker-item :global(svg) {
          margin-left: auto;
          color: var(--accent-gold);
        }

        .picker-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #1a1400;
        }

        .picker-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .picker-name {
          font-weight: 500;
        }

        /* Body */
        .channel-body {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          display: flex; flex-direction: column; position: relative;
        }
        .voice-mode {
          overflow: hidden;
        }

        .scroll-btn {
          position: sticky;
          bottom: 12px;
          align-self: center;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-primary);
          border-radius: 50%;
          color: var(--text-secondary);
          cursor: pointer;
          box-shadow: var(--shadow-md);
          transition: all 0.2s ease;
          z-index: 5;
        }

        .scroll-btn:hover {
          background: var(--accent-gold-dim);
          color: var(--accent-gold);
          border-color: rgba(197, 165, 90, 0.2);
        }

        /* Skeleton */
        .loading-state { flex: 1; overflow: hidden; }
        .skeleton-messages { display: flex; flex-direction: column; gap: 18px; padding: 20px; }
        .skeleton-msg { display: flex; gap: 10px; animation: fadeIn 0.4s ease backwards; }
        .skeleton-avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; }
        .skeleton-content { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .skeleton-name { width: 100px; height: 12px; }
        .skeleton-text { width: 75%; height: 12px; }

        @media (max-width: 768px) {
          .channel-header {
            padding: 10px 14px 10px 48px;
          }
          .header-desc { display: none; }
        }

        @media (max-width: 1100px) {
          .member-count { display: none; }
        }
      `}</style>
    </div>
  );
}
