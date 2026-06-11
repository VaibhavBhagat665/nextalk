"use client";

import { X, Download, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function DownloadAppDialog({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="dialog-overlay animate-fade-in" onClick={onClose} />
      <div className="dialog-wrapper">
        <div className="dialog-content animate-scale-in" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <button className="dialog-close" onClick={onClose}>
            <X size={16} />
          </button>

          <div className="dialog-header">
            <h2 className="dialog-title">Get the Mobile App</h2>
            <p className="dialog-subtitle">Scan to download or click the button below.</p>
          </div>

          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px' }}>
            <div style={{ padding: '15px', background: 'var(--surface-sunken)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <QRCodeSVG 
                value="https://your-website.com/nextalk.apk" 
                size={180}
                bgColor="#151515"
                fgColor="#D4AF37"
                level="Q"
                includeMargin={true}
                style={{ borderRadius: '8px' }}
              />
            </div>
            
            <a href="/nextalk.apk" download className="btn-primary" style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: '8px' }}>
              <Download size={16} /> Download APK Directly
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dialog-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px); z-index: 100;
        }
        .dialog-wrapper {
          position: fixed; inset: 0; z-index: 101; pointer-events: none;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .dialog-content {
          background: var(--bg-elevated); border: 1px solid var(--border-primary);
          border-radius: var(--radius-xl); width: 100%; max-width: 480px;
          padding: 24px; box-shadow: var(--shadow-xl); pointer-events: auto;
        }
        .dialog-close {
          position: absolute; top: 16px; right: 16px; background: var(--bg-tertiary);
          border: 1px solid var(--border-secondary); color: var(--text-muted);
          width: 28px; height: 28px; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; cursor: pointer;
        }
        .dialog-close:hover { color: var(--text-primary); border-color: var(--border-primary); }
        .dialog-header { margin-bottom: 20px; }
        .dialog-title { font-family: "Bubblegum Sans", cursive; font-size: 24px; color: var(--text-primary); }
        .dialog-subtitle { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
        .btn-primary {
          background: var(--gradient-primary); color: white; border: none;
          padding: 12px 20px; border-radius: var(--radius-md); font-weight: 600;
          cursor: pointer; text-decoration: none; align-items: center;
        }
        .btn-primary:hover { opacity: 0.9; }
      `}</style>
    </>
  );
}
