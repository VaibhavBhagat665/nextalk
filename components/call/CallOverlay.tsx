"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Loader2 } from "lucide-react";

interface CallOverlayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callStatus: "connecting" | "active" | "ended";
  callType: "voice" | "video";
  remoteUser: { username: string; imageUrl: string };
  onEndCall: () => void;
  onToggleMic: (enabled: boolean) => void;
  onToggleVideo: (enabled: boolean) => void;
}

export default function CallOverlay({
  localStream,
  remoteStream,
  callStatus,
  callType,
  remoteUser,
  onEndCall,
  onToggleMic,
  onToggleVideo,
}: CallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(callType === "video");
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, videoEnabled]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === "active") {
      interval = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleToggleMic = () => {
    const newStatus = !micEnabled;
    setMicEnabled(newStatus);
    onToggleMic(newStatus);
  };

  const handleToggleVideo = () => {
    const newStatus = !videoEnabled;
    setVideoEnabled(newStatus);
    onToggleVideo(newStatus);
  };

  return (
    <div className="call-overlay animate-fade-in">
      <div className="call-header glass-strong">
        <div className="call-info">
          <h2>{remoteUser.username}</h2>
          <span className="duration">
            {callStatus === "connecting" ? "Connecting..." : formatDuration(duration)}
          </span>
        </div>
      </div>

      <div className="call-grid">
        {/* Remote Video / Audio Placeholder */}
        <div className="video-container remote-video">
          {callStatus === "active" && remoteStream && callType === "video" ? (
            <video ref={remoteVideoRef} autoPlay playsInline />
          ) : (
            <div className="audio-placeholder">
              {remoteUser.imageUrl ? (
                <img src={remoteUser.imageUrl} alt={remoteUser.username} className="avatar" />
              ) : (
                <div className="avatar-fallback">{remoteUser.username[0].toUpperCase()}</div>
              )}
              {callStatus === "connecting" && (
                <div className="connecting-pulse">
                  <Loader2 size={32} className="spin text-gold" />
                </div>
              )}
            </div>
          )}
          {callStatus === "active" && remoteStream && callType === "voice" && (
            <audio ref={remoteVideoRef} autoPlay />
          )}
        </div>

        {/* Local Video (PiP) */}
        {callType === "video" && localStream && (
          <div className="video-container local-video glass">
            {videoEnabled ? (
              <video ref={localVideoRef} autoPlay playsInline muted />
            ) : (
              <div className="audio-placeholder local-placeholder">
                <VideoOff size={24} className="text-muted" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="call-controls glass-strong">
        <div className="controls-group">
          <button 
            className={`control-btn ${!micEnabled ? "control-btn--danger" : ""}`} 
            onClick={handleToggleMic}
            title={micEnabled ? "Mute" : "Unmute"}
          >
            {!micEnabled ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button 
            className={`control-btn ${!videoEnabled ? "control-btn--danger" : ""}`} 
            onClick={handleToggleVideo}
            title={videoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {!videoEnabled ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button 
            className="control-btn"
            title="Share Screen (Coming soon)"
          >
            <MonitorUp size={20} />
          </button>
        </div>
        
        <button className="end-call-btn" onClick={onEndCall} title="End Call">
          <PhoneOff size={22} />
        </button>
      </div>

      <style jsx>{`
        .call-overlay {
          position: absolute;
          inset: 0;
          z-index: 50;
          background: var(--bg-primary);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .call-header {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          padding: 12px 24px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .call-info {
          text-align: center;
        }

        .call-info h2 {
          font-family: var(--font-heading);
          font-size: 20px;
          font-weight: 400;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .duration {
          font-size: 13px;
          color: var(--accent-gold);
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .call-grid {
          flex: 1;
          position: relative;
          background: #0a0806; /* Always dark for call background */
        }

        .video-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .remote-video video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .local-video {
          position: absolute;
          bottom: 24px;
          right: 24px;
          width: 180px;
          height: 240px;
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border-glow);
          background: var(--bg-elevated);
        }

        .local-video video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1); /* Mirror self */
        }

        .audio-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .avatar, .avatar-fallback {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid var(--border-primary);
          box-shadow: var(--shadow-glow);
        }

        .avatar {
          object-fit: cover;
        }

        .avatar-fallback {
          background: var(--gradient-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 700;
          color: #1a1400;
        }

        .local-placeholder {
          width: 100%;
          height: 100%;
          background: var(--bg-tertiary);
          justify-content: center;
        }

        .connecting-pulse {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 8, 6, 0.6);
          backdrop-filter: blur(4px);
        }

        .call-controls {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 12px;
          border-radius: 40px;
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-lg);
        }

        .controls-group {
          display: flex;
          gap: 12px;
        }

        .control-btn {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
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

        .control-btn--danger {
          background: rgba(251, 113, 133, 0.15);
          color: var(--accent-rose);
          border-color: rgba(251, 113, 133, 0.3);
        }

        .end-call-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--accent-rose);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s var(--ease-smooth);
          box-shadow: 0 4px 12px rgba(251, 113, 133, 0.3);
        }

        .end-call-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(251, 113, 133, 0.4);
        }
        
        .text-gold { color: var(--accent-gold); }
        .text-muted { color: var(--text-tertiary); }
        :global(.spin) { animation: spin 1s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
