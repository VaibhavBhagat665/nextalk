/**
 * Mobile Image Upload Utilities
 * 
 * Provides image picker, camera, compression, and upload functionality
 * for React Native using Expo APIs
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';

/**
 * Configuration for image optimization
 */
export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
}

/**
 * Result of image optimization
 */
export interface OptimizedImageResult {
  uri: string;
  width: number;
  height: number;
  originalSize?: number;
  compressedSize?: number;
}

/**
 * Default optimization settings
 */
const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
};

/**
 * Request camera permissions
 * @returns true if permission granted
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  
  if (status !== 'granted') {
    Alert.alert(
      'Camera Permission',
      'Camera access is needed to take photos. Please enable it in settings.',
      [{ text: 'OK' }]
    );
    return false;
  }
  
  return true;
}

/**
 * Request media library permissions
 * @returns true if permission granted
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (status !== 'granted') {
    Alert.alert(
      'Media Library Permission',
      'Photo library access is needed to select images. Please enable it in settings.',
      [{ text: 'OK' }]
    );
    return false;
  }
  
  return true;
}

/**
 * Pick an image from the device gallery
 * @param options - Optimization options
 * @returns Optimized image or null if cancelled
 */
export async function pickImageFromGallery(
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImageResult | null> {
  // Request permission
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return null;

  // Launch image picker
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1, // Use max quality initially, we'll compress it
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  
  // Optimize the image
  return await optimizeImage(asset.uri, {
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

/**
 * Capture an image using the device camera
 * @param options - Optimization options
 * @returns Optimized image or null if cancelled
 */
export async function captureImageWithCamera(
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImageResult | null> {
  // Request permission
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  // Launch camera
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1, // Use max quality initially, we'll compress it
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  
  // Optimize the image
  return await optimizeImage(asset.uri, {
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

/**
 * Optimize an image by resizing and compressing
 * @param uri - Image URI
 * @param options - Optimization options
 * @returns Optimized image result
 */
export async function optimizeImage(
  uri: string,
  options: Required<ImageOptimizationOptions>
): Promise<OptimizedImageResult> {
  try {
    // Get original image info
    const originalInfo = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
    });

    // Calculate dimensions maintaining aspect ratio
    let width = originalInfo.width;
    let height = originalInfo.height;

    if (width > options.maxWidth || height > options.maxHeight) {
      const aspectRatio = width / height;
      
      if (width > height) {
        width = options.maxWidth;
        height = Math.round(width / aspectRatio);
      } else {
        height = options.maxHeight;
        width = Math.round(height * aspectRatio);
      }
    }

    // Resize and compress
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width, height } }],
      {
        compress: options.quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return {
      uri: manipResult.uri,
      width,
      height,
      originalSize: undefined, // Not available in Expo
      compressedSize: undefined, // Not available in Expo
    };
  } catch (error) {
    console.error('Error optimizing image:', error);
    // Return original if optimization fails
    return {
      uri,
      width: 0,
      height: 0,
    };
  }
}

/**
 * Upload an image to Cloudinary via the Next.js API
 * @param imageUri - Local image URI
 * @param token - Auth token
 * @param onProgress - Progress callback (0-100)
 * @returns Cloudinary URL
 */
export async function uploadImageToCloudinary(
  imageUri: string,
  token: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    // Get upload signature from API
    const signatureResponse = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!signatureResponse.ok) {
      throw new Error('Failed to get upload signature');
    }

    const signatureData = await signatureResponse.json();
    const { timestamp, signature, folder, apiKey, cloudName } = signatureData;

    // Prepare form data
    const formData = new FormData();
    
    // Add the image file
    const imageFile = {
      uri: imageUri,
      type: 'image/jpeg',
      name: `image_${Date.now()}.jpg`,
    } as any;
    
    formData.append('file', imageFile);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('api_key', apiKey);

    // Upload to Cloudinary
    onProgress?.(10);
    
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    onProgress?.(90);

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image to Cloudinary');
    }

    const uploadData = await uploadResponse.json();
    onProgress?.(100);

    return uploadData.secure_url;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Show action sheet for image source selection
 * @param onPickImage - Callback with optimized image
 * @param options - Optimization options
 */
export async function showImageSourcePicker(
  onPickImage: (image: OptimizedImageResult) => void,
  options: ImageOptimizationOptions = {}
): Promise<void> {
  Alert.alert(
    'Select Image Source',
    'Choose where to get your image from',
    [
      {
        text: 'Camera',
        onPress: async () => {
          const image = await captureImageWithCamera(options);
          if (image) {
            onPickImage(image);
          }
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const image = await pickImageFromGallery(options);
          if (image) {
            onPickImage(image);
          }
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
}
