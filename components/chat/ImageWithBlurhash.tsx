"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { decode } from "blurhash";
import { X, ZoomIn, Download } from "lucide-react";

interface ImageWithBlurhashProps {
  src: string;
  alt: string;
  blurhash?: string;
  width: number;
  height: number;
  className?: string;
  onClick?: () => void;
}

/**
 * ImageWithBlurhash — Renders an image with blurhash placeholder
 * and maintains aspect ratio
 */
export function ImageWithBlurhash({
  src,
  alt,
  blurhash,
  width,
  height,
  className = "",
  onClick,
}: ImageWithBlurhashProps) {
  const [blurhashUrl, setBlurhashUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Generate blurhash placeholder
  useEffect(() => {
    if (!blurhash) return;

    try {
      const pixels = decode(blurhash, 32, 32);
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        const imageData = ctx.createImageData(32, 32);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);
        setBlurhashUrl(canvas.toDataURL());
      }
    } catch (err) {
      console.error("Failed to decode blurhash:", err);
    }
  }, [blurhash]);

  // Calculate aspect ratio
  const aspectRatio = height / width;
  const maxWidth = 400;
  const displayWidth = Math.min(width, maxWidth);
  const displayHeight = displayWidth * aspectRatio;

  return (
    <div
      className={`image-with-blurhash ${className}`}
      style={{
        width: displayWidth,
        height: displayHeight,
        position: "relative",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      {/* Blurhash placeholder */}
      {blurhashUrl && !imageLoaded && (
        <div
          className="blurhash-placeholder"
          style={{
            backgroundImage: `url(${blurhashUrl})`,
            backgroundSize: "cover",
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />
      )}

      {/* Actual image */}
      <Image
        src={src}
        alt={alt}
        width={displayWidth}
        height={displayHeight}
        className={`image ${imageLoaded ? "image--loaded" : ""}`}
        onLoad={() => setImageLoaded(true)}
        style={{ objectFit: "contain" }}
      />

      {/* Zoom icon overlay */}
      {onClick && (
        <div className="zoom-overlay">
          <ZoomIn size={24} />
        </div>
      )}

      <style jsx>{`
        .image-with-blurhash {
          border-radius: var(--radius);
          overflow: hidden;
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }

        .image-with-blurhash:hover {
          box-shadow: var(--shadow-md);
          border-color: var(--accent-gold-dim);
        }

        .blurhash-placeholder {
          filter: blur(20px);
          transform: scale(1.1);
        }

        .image {
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .image--loaded {
          opacity: 1;
        }

        .zoom-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s ease;
          color: white;
        }

        .image-with-blurhash:hover .zoom-overlay {
          opacity: 1;
        }

        @media (max-width: 768px) {
          .zoom-overlay {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * ImageLightbox — Full-screen image viewer with download and close
 */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = alt || "image";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-header">
          <span className="lightbox-title">{alt}</span>
          <div className="lightbox-actions">
            <button
              className="lightbox-btn"
              onClick={handleDownload}
              title="Download"
            >
              <Download size={20} />
            </button>
            <button
              className="lightbox-btn"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="lightbox-image-container">
          <Image
            src={src}
            alt={alt}
            width={1920}
            height={1080}
            className="lightbox-image"
            style={{ objectFit: "contain" }}
          />
        </div>
      </div>

      <style jsx>{`
        .lightbox-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .lightbox-content {
          max-width: 95vw;
          max-height: 95vh;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .lightbox-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 4px;
        }

        .lightbox-title {
          color: white;
          font-size: 14px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .lightbox-actions {
          display: flex;
          gap: 8px;
        }

        .lightbox-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 8px;
          border-radius: var(--radius);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .lightbox-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.3);
          transform: scale(1.05);
        }

        .lightbox-image-container {
          position: relative;
          max-width: 90vw;
          max-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lightbox-image :global(img) {
          max-width: 100%;
          max-height: 80vh;
          object-fit: contain;
          border-radius: var(--radius);
        }

        @media (max-width: 768px) {
          .lightbox-header {
            padding: 0;
          }

          .lightbox-title {
            font-size: 12px;
          }

          .lightbox-btn {
            padding: 6px;
          }
        }
      `}</style>
    </div>
  );
}
