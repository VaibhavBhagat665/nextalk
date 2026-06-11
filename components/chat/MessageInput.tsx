"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Send,
  Paperclip,
  ImagePlus,
  Smile,
  Mic,
  X,
  Loader2,
} from "lucide-react";

/**
 * MessageInput — Premium chat input bar with file upload, image picker,
 * emoji/voice placeholders, and a gold gradient send button.
 */
export default function MessageInput({
  onSend,
  onTyping,
  disabled,
}: {
  onSend: (
    content: string,
    fileUrl?: string,
    fileName?: string,
    fileType?: string
  ) => void;
  onTyping: () => void;
  disabled?: boolean;
}) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const COMMON_EMOJIS = ["😀","😂","🤣","😊","🥰","😍","😒","😭","😩","🥺","😡","👍","👎","👏","🙌","🔥","✨","💯","❤️","💔","🎉"];

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const uploadToCloudinary = async (file: File): Promise<{ url: string } | null> => {
    try {
      setUploading(true);
      setUploadProgress(0);

      // Get signed upload params
      const paramsRes = await fetch("/api/upload", { method: "POST" });
      if (!paramsRes.ok) throw new Error("Failed to get upload params");
      const params = await paramsRes.json();

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("timestamp", params.timestamp.toString());
      formData.append("signature", params.signature);
      formData.append("api_key", params.apiKey);
      formData.append("folder", params.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${params.cloudName}/auto/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        const errorData = await uploadRes.text();
        console.error("Cloudinary error details:", errorData);
        throw new Error(`Upload failed: ${errorData}`);
      }

      const data = await uploadRes.json();
      return { url: data.secure_url };
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!content.trim() && !file) || disabled) return;

    let fileUrl: string | undefined;
    let fileName: string | undefined;
    let fileType: string | undefined;

    if (file) {
      const result = await uploadToCloudinary(file);
      if (result) {
        fileUrl = result.url;
        fileName = file.name;
        fileType = file.type;
      }
    }

    onSend(content.trim(), fileUrl, fileName, fileType);
    setContent("");
    setFile(null);
    setFilePreview(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Max 10MB
    if (selectedFile.size > 10 * 1024 * 1024) {
      alert("File size must be under 10MB");
      return;
    }

    setFile(selectedFile);

    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
      onTyping();

      // Auto-resize
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    },
    [onTyping]
  );

  const hasContent = content.trim() || file;

  return (
    <div className="message-input-wrapper">
      {/* File preview */}
      {file && (
        <div className="file-preview animate-slide-in-up">
          {filePreview ? (
            <img src={filePreview} alt={file.name} className="preview-image" />
          ) : (
            <div className="preview-file">
              <Paperclip size={15} />
              <span>{file.name}</span>
            </div>
          )}
          <button className="remove-file" onClick={removeFile}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="upload-progress">
          <div
            className="upload-bar"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <form className="message-input" onSubmit={handleSubmit}>
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="file-input-hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          id="file-upload"
        />
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleFileSelect}
          className="file-input-hidden"
          accept="image/*"
          id="image-upload"
        />

        {/* Left action buttons */}
        <div className="input-actions-left">
          <button
            type="button"
            className="input-action"
            onClick={() => fileInputRef.current?.click()}
            data-tooltip="Attach file"
            id="attach-file-btn"
          >
            <Paperclip size={17} />
          </button>

          <button
            type="button"
            className="input-action"
            onClick={() => imageInputRef.current?.click()}
            data-tooltip="Upload image"
            id="attach-image-btn"
          >
            <ImagePlus size={17} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="message-textarea"
          rows={1}
          disabled={disabled || uploading}
          id="message-input"
        />

        {/* Right action buttons */}
        <div className="input-actions-right">
          <div className="emoji-picker-container" ref={emojiPickerRef}>
            <button
              type="button"
              className="input-action"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              data-tooltip="Emoji"
              id="emoji-btn"
            >
              <Smile size={17} />
            </button>
            
            {showEmojiPicker && (
              <div className="emoji-popover animate-scale-in">
                <div className="emoji-grid">
                  {COMMON_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-btn"
                      onClick={() => {
                        setContent(prev => prev + emoji);
                        setShowEmojiPicker(false);
                        textareaRef.current?.focus();
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="input-action"
            data-tooltip="Voice memo"
            id="voice-btn"
          >
            <Mic size={17} />
          </button>

          {/* Gold Send Button */}
          <button
            type="submit"
            className={`send-button ${hasContent ? "send-button--active" : ""}`}
            disabled={(!content.trim() && !file) || disabled || uploading}
            id="send-message-btn"
          >
            {uploading ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
          </button>
        </div>
      </form>

      <style jsx>{`
        .message-input-wrapper {
          padding: 0 20px 16px;
        }

        .file-preview {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          border-bottom: none;
        }

        .preview-image {
          height: 56px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid var(--border-primary);
        }

        .preview-file {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
        }

        .remove-file {
          margin-left: auto;
          background: rgba(251, 113, 133, 0.1);
          border: none;
          color: var(--accent-rose);
          padding: 5px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          transition: all 0.2s ease;
        }

        .remove-file:hover {
          background: var(--accent-rose);
          color: white;
          transform: scale(1.1);
        }

        .upload-progress {
          height: 2px;
          background: var(--bg-tertiary);
          overflow: hidden;
          border-radius: 2px;
        }

        .upload-bar {
          height: 100%;
          background: var(--gradient-gold);
          transition: width 0.3s ease;
          border-radius: 2px;
        }

        .message-input {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: ${file ? "0 0 var(--radius-lg) var(--radius-lg)" : "var(--radius-lg)"};
          padding: 6px 8px;
          transition: all 0.25s var(--ease-smooth);
        }

        .message-input:focus-within {
          border-color: rgba(212, 162, 60, 0.25);
          box-shadow: 0 0 0 3px rgba(212, 162, 60, 0.05), 0 2px 12px rgba(14, 12, 10, 0.18);
        }

        .file-input-hidden {
          display: none;
        }

        .input-actions-left,
        .input-actions-right {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .input-action {
          background: none;
          border: none;
          color: var(--text-muted);
          padding: 7px;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: flex;
        }

        .input-action:hover {
          background: var(--bg-hover);
          color: var(--accent-gold);
        }

        .message-textarea {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.5;
          padding: 7px 4px;
          resize: none;
          outline: none;
          font-family: inherit;
          max-height: 150px;
          letter-spacing: -0.01em;
          min-width: 0;
        }

        .message-textarea::placeholder {
          color: var(--text-muted);
        }

        /* Gold gradient send button */
        .send-button {
          background: rgba(212, 162, 60, 0.08);
          border: none;
          color: var(--text-muted);
          padding: 8px;
          border-radius: 10px;
          cursor: not-allowed;
          transition: all 0.25s var(--ease-spring);
          display: flex;
          flex-shrink: 0;
        }

        .send-button--active {
          background: var(--gradient-gold);
          color: #1a1400;
          cursor: pointer;
          box-shadow: 0 0 16px rgba(232, 184, 75, 0.2);
        }

        .send-button--active:hover {
          transform: scale(1.1);
          box-shadow: 0 0 24px rgba(232, 184, 75, 0.35);
        }

        @media (max-width: 768px) {
          .message-input-wrapper {
            padding: 0 12px 14px;
          }

          .input-actions-left {
            display: none;
          }
        }
        /* Emoji Picker */
        .emoji-picker-container {
          position: relative;
        }
        .emoji-popover {
          position: absolute;
          bottom: calc(100% + 12px);
          right: -10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-lg);
          padding: 12px;
          box-shadow: var(--shadow-lg);
          z-index: 100;
          width: 260px;
        }
        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .emoji-btn {
          background: none;
          border: none;
          font-size: 20px;
          padding: 6px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: transform 0.2s var(--ease-smooth), background-color 0.2s;
        }
        .emoji-btn:hover {
          background: var(--bg-hover);
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
}
