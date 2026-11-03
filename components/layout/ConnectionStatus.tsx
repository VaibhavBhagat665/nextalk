"use client";

import { useEffect, useState } from "react";
import { useSocketContext } from "@/components/providers/SocketProvider";

export default function ConnectionStatus() {
  const { status, error, reconnect } = useSocketContext();
  const [showBanner, setShowBanner] = useState(false);
  const [showDelayTimeout, setShowDelayTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only show banner after 3 seconds of being disconnected/reconnecting
    if (status === "reconnecting" || status === "disconnected" || status === "error") {
      const timeout = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
      setShowDelayTimeout(timeout);

      return () => {
        if (timeout) clearTimeout(timeout);
      };
    } else {
      // Hide banner immediately when connected
      if (showDelayTimeout) {
        clearTimeout(showDelayTimeout);
        setShowDelayTimeout(null);
      }
      setShowBanner(false);
    }
  }, [status]);

  if (!showBanner || status === "connected") {
    return null;
  }

  return (
    <div className="connection-status-banner">
      <div className="banner-content">
        <div className="status-indicator">
          {status === "reconnecting" && (
            <>
              <div className="spinner" />
              <span>Reconnecting...</span>
            </>
          )}
          {status === "disconnected" && (
            <>
              <div className="dot disconnected" />
              <span>Disconnected from server</span>
            </>
          )}
          {status === "error" && (
            <>
              <div className="dot error" />
              <span>{error || "Connection error"}</span>
            </>
          )}
        </div>
        
        <button onClick={reconnect} className="retry-button">
          Retry now
        </button>
      </div>

      <style jsx>{`
        .connection-status-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          color: white;
          padding: 12px 16px;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .banner-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 500;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .dot.disconnected {
          background: rgba(255, 255, 255, 0.8);
        }

        .dot.error {
          background: #fef2f2;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .retry-button {
          padding: 6px 16px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(8px);
        }

        .retry-button:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .retry-button:active {
          transform: scale(0.97);
        }

        @media (max-width: 640px) {
          .banner-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .retry-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
