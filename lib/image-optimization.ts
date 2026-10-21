/**
 * Image optimization utilities for client-side image processing
 * before upload to Cloudinary
 */

import imageCompression from "browser-image-compression";
import { encode as encodeBlurhash } from "blurhash";

/**
 * Configuration for image optimization
 */
export interface ImageOptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  quality?: number;
}

/**
 * Result of image optimization including compressed file and metadata
 */
export interface OptimizedImage {
  file: File;
  blurhash: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

/**
 * Default optimization options
 */
const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  quality: 0.85,
};

/**
 * Optimize an image file by compressing and generating blurhash
 * @param file - The original image file
 * @param options - Optimization options
 * @returns Optimized image with metadata
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // Compress the image
  const compressedFile = await imageCompression(file, {
    maxSizeMB: opts.maxSizeMB!,
    maxWidthOrHeight: opts.maxWidthOrHeight!,
    useWebWorker: opts.useWebWorker!,
    initialQuality: opts.quality!,
  });

  // Generate blurhash
  const { blurhash, width, height } = await generateBlurhash(compressedFile);

  return {
    file: compressedFile,
    blurhash,
    width,
    height,
    originalSize,
    compressedSize: compressedFile.size,
  };
}

/**
 * Generate blurhash from an image file
 * @param file - Image file
 * @returns Blurhash string and image dimensions
 */
export async function generateBlurhash(
  file: File
): Promise<{ blurhash: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      // Use smaller dimensions for blurhash calculation (faster)
      const maxSize = 64;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);

      // Generate blurhash (4x3 components for good balance)
      const blurhash = encodeBlurhash(
        imageData.data,
        imageData.width,
        imageData.height,
        4,
        3
      );

      resolve({
        blurhash,
        width: img.width,
        height: img.height,
      });

      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Check if a file is an image
 * @param file - File to check
 * @returns True if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Calculate compression ratio
 * @param originalSize - Original file size in bytes
 * @param compressedSize - Compressed file size in bytes
 * @returns Compression ratio as percentage saved
 */
export function calculateCompressionRatio(
  originalSize: number,
  compressedSize: number
): number {
  return Math.round((1 - compressedSize / originalSize) * 100);
}