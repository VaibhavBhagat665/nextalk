"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Headphones, Video, VideoOff, PhoneOff, MonitorUp, Volume2 } from "lucide-react";
import { useVoiceChannel, VoiceParticipant } from "@/hooks/useVoiceChannel";

interface VoiceChannelPanelProps {
  channelId: string;
  currentUserId?: string;
  channelName: string;
}

export default function VoiceChannelPanel({ channelId, currentUserId, channelName }: VoiceChannelPanelProps) {
  const {
    participants,
    isConnected,
    localStream,
    isMuted,
    isDeafened,
    isVideoOn,
    connectToVoice,
    disconnectFromVoice,
    toggleMute,
    toggleDeafen,
    toggleVideo
  } = useVoiceChannel(channelId, currentUserId);

  // Clean up on unmount only (no auto-connect!)
  useEffect(() => {
    return () => {
      disconnectFromVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return (
    <div className="voice-panel">
      <div className="voice-header">
        <div className="voice-title">
          {isConnected && <div className="live-badge">LIVE</div>}
          <h2>{channelName}</h2>
        </div>
        <div className="participants-count">
          {participants.length + (isConnected ? 1 : 0)} in channel
        </div>
      </div>

      <div className="voice-grid">
        {/* Local User */}
        {isConnected && (
          <VideoCell
            stream={localStream}
            isLocal={true}
            muted={isMuted}
            video={isVideoOn}
            username="You"
            imageUrl={null}
          />
        )}
        
        {/* Remote Users */}
        {participants.map((p) => (
          <VideoCell
            key={p.socketId}
            stream={p.stream}
            isLocal={false}
            muted={p.muted}
            video={p.video}
            username={p.username}
            imageUrl={p.imageUrl}
          />
        ))}
        
        {/* Not connected — show join button */}
        {!isConnected && (
          <div className="join-state">
            <div className="join-icon">
              <Volume2 size={36} />
            </div>
            <h3>Voice Channel</h3>
            <p>Click below to join the voice channel</p>
            <button className="join-btn" onClick={connectToVoice} id="join-voice-btn">
              <Mic size={18} />
              <span>Join Voice</span>
            </button>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="voice-controls-bar">
          <div className="control-group">
            <button 
              className={`control-btn ${isMuted ? "control-btn--danger" : ""}`}
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            
            <button 
              className={`control-btn ${isDeafened ? "control-btn--danger" : ""}`}
              onClick={toggleDeafen}
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              <Headphones size={20} />
            </button>
            
            <button 
              className={`control-btn ${isVideoOn ? "control-btn--active" : ""}`}
              onClick={toggleVideo}
              title={isVideoOn ? "Turn off camera" : "Turn on camera"}
            >
              {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            
            <button 
              className="control-btn"
              title="Share Screen (Coming soon)"
            >
              <MonitorUp size={20} />
            </button>
          </div>
          
          <button 
            className="disconnect-btn"
            onClick={disconnectFromVoice}
            title="Disconnect"
          >
            <PhoneOff size={20} />
            <span>Disconnect</span>
          </button>
        </div>
      )}

      <style jsx>{`
        .voice-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary);
          padding: 20px;
          gap: 20px;
        }
        .voice-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .voice-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .live-badge {
          background: var(--accent-rose);
          color: white;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 6px;
          letter-spacing: 1px;
          animation: pulse-glow 2s infinite;
        }
        .voice-title h2 {
          font-family: var(--font-heading);
          font-size: 24px;
          color: var(--text-primary);
          margin: 0;
        }
        .participants-count {
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 600;
        }
        .voice-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          align-content: start;
          overflow-y: auto;
          min-height: 0;
        }
        .join-state {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 300px;
          color: var(--text-muted);
          gap: 12px;
          text-align: center;
        }
        .join-icon {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: var(--accent-gold-dim);
          color: var(--accent-gold);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 8px;
        }
        .join-state h3 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 20px; font-weight: 700;
          color: var(--text-primary);
        }
        .join-state p {
          font-size: 14px;
          color: var(--text-tertiary);
          margin-bottom: 8px;
        }
        .join-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 14px 32px;
          background: var(--accent-emerald);
          color: white;
          border: none;
          border-radius: 24px;
          font-size: 15px; font-weight: 700;
          cursor: pointer;
          transition: all 0.2s var(--ease-smooth);
          font-family: inherit;
        }
        .join-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(75, 181, 130, 0.3);
        }
        .voice-controls-bar {
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .control-group {
          display: flex;
          gap: 12px;
        }
        .control-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s var(--ease-smooth);
        }
        .control-btn:hover {
          background: var(--bg-hover);
          transform: translateY(-2px);
        }
        .control-btn--active {
          background: var(--accent-gold);
          color: white;
        }
        .control-btn--danger {
          background: rgba(251, 113, 133, 0.15);
          color: var(--accent-rose);
        }
        .disconnect-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--accent-rose);
          color: white;
          border: none;
          padding: 0 20px;
          height: 48px;
          border-radius: 24px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s var(--ease-smooth);
        }
        .disconnect-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(251, 113, 133, 0.3);
        }
      `}</style>
    </div>
  );
}

function VideoCell({ stream, isLocal, muted, video, username, imageUrl }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-cell">
      {video && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="video-element"
        />
      ) : (
        <div className="avatar-fallback">
          {imageUrl ? (
            <img src={imageUrl} alt={username} />
          ) : (
            <span>{username[0].toUpperCase()}</span>
          )}
        </div>
      )}
      
      <div className="user-overlay">
        <span className="user-name">{username}</span>
        {muted && (
          <div className="muted-indicator">
            <MicOff size={14} />
          </div>
        )}
      </div>

      <style jsx>{`
        .video-cell {
          aspect-ratio: 16 / 9;
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          border: 2px solid var(--border-primary);
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .video-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: ${isLocal ? "scaleX(-1)" : "none"};
        }
        .avatar-fallback {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 800;
          color: white;
          overflow: hidden;
          font-family: var(--font-heading);
        }
        .avatar-fallback img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .user-overlay {
          position: absolute;
          bottom: 12px;
          left: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
        }
        .user-name {
          color: white;
          font-size: 14px;
          font-weight: 600;
        }
        .muted-indicator {
          color: var(--accent-rose);
          display: flex;
          align-items: center;
        }
      `}</style>
    </div>
  );
}
