"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  Loader2,
  FileText,
  ImageIcon,
  Paperclip,
} from "lucide-react";

/**
 * UploadFileDialog — Dedicated upload modal with drag-and-drop,
 * file preview, and Cloudinary upload integration.
 */
export default function UploadFileDialog({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: (fileUrl: string, fileName: string, fileType: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must be under 10MB");
      return;
    }

    setError("");
    setFile(selectedFile);

    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      const paramsRes = await fetch("/api/upload", { method: "POST" });
      if (!paramsRes.ok) throw new Error("Failed to get upload params");
      const params = await paramsRes.json();

      setUploadProgress(30);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("timestamp", params.timestamp.toString());
      formData.append("signature", params.signature);
      formData.append("api_key", params.apiKey);
      formData.append("folder", params.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${params.cloudName}/auto/upload`,
        { method: "POST", body: formData }
      );

      setUploadProgress(80);

      if (!uploadRes.ok) throw new Error("Upload failed");

      const data = await uploadRes.json();
      setUploadProgress(100);

      onUpload(data.secure_url, file.name, file.type);
      onClose();
    } catch (err) {
      setError("Upload failed. Please try again.");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = () => {
    if (!file) return <Upload size={32} />;
    if (file.type.startsWith("image/")) return <ImageIcon size={32} />;
    return <FileText size={32} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog glass-strong animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>Upload File</h2>
          <button className="btn-ghost" onClick={onClose} id="upload-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <div
          className={`drop-zone ${dragOver ? "drop-zone--active" : ""} ${file ? "drop-zone--has-file" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleInputChange}
            className="file-input-hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            id="upload-file-input"
          />

          {file ? (
            <div className="file-info">
              {filePreview ? (
                <img src={filePreview} alt={file.name} className="file-preview-img" />
              ) : (
                <div className="file-icon-wrap">{getFileIcon()}</div>
              )}
              <div className="file-details">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatFileSize(file.size)}</span>
              </div>
              <button className="remove-btn" onClick={removeFile}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="drop-content">
              <div className="drop-icon">
                <Upload size={28} />
              </div>
              <p className="drop-text">
                <strong>Click to upload</strong> or drag and drop
              </p>
              <p className="drop-hint">PNG, JPG, PDF, DOC up to 10MB</p>
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="progress-text">{uploadProgress}%</span>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-gold"
            onClick={handleUpload}
            disabled={!file || uploading}
            id="upload-submit-btn"
          >
            {uploading ? (
              <><Loader2 size={16} className="spin" /> Uploading...</>
            ) : (
              <><Paperclip size={16} /> Upload</>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }

        .dialog {
          width: 100%;
          max-width: 460px;
          padding: 24px;
          border-radius: var(--radius-xl);
        }

        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .dialog-header h2 {
          font-family: "Fredoka", "Comic Neue", sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .file-input-hidden {
          display: none;
        }

        /* Drop Zone */
        .drop-zone {
          border: 2px dashed var(--border-primary);
          border-radius: var(--radius-lg);
          padding: 32px;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s var(--ease-smooth);
          background: var(--bg-tertiary);
        }

        .drop-zone:hover {
          border-color: var(--accent-gold-dim);
          background: var(--bg-hover);
        }

        .drop-zone--active {
          border-color: var(--accent-gold);
          background: var(--accent-gold-dim);
          box-shadow: 0 0 0 4px rgba(212, 162, 60, 0.06);
        }

        .drop-zone--has-file {
          cursor: default;
          padding: 16px;
        }

        .drop-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .drop-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-gold-dim);
          border-radius: 16px;
          color: var(--accent-gold);
          margin-bottom: 4px;
        }

        .drop-text {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .drop-text strong {
          color: var(--accent-gold);
        }

        .drop-hint {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* File Info */
        .file-info {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .file-preview-img {
          width: 56px;
          height: 56px;
          object-fit: cover;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-primary);
        }

        .file-icon-wrap {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-gold-dim);
          border-radius: var(--radius-sm);
          color: var(--accent-gold);
        }

        .file-details {
          flex: 1;
          text-align: left;
          min-width: 0;
        }

        .file-name {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          display: block;
          font-size: 12px;
          color: var(--text-tertiary);
          margin-top: 2px;
        }

        .remove-btn {
          background: rgba(251, 113, 133, 0.1);
          border: none;
          color: var(--accent-rose);
          padding: 6px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .remove-btn:hover {
          background: var(--accent-rose);
          color: white;
        }

        /* Progress */
        .progress-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
        }

        .progress-bar {
          flex: 1;
          height: 4px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--gradient-gold);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-gold);
          min-width: 32px;
          text-align: right;
        }

        .error-message {
          padding: 10px;
          background: rgba(244, 63, 94, 0.08);
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: var(--radius-sm);
          color: var(--accent-rose);
          font-size: 13px;
          margin-top: 12px;
        }

        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 20px;
        }

        .dialog-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
