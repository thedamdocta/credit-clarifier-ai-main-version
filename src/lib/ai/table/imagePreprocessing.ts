import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Image preprocessing utilities for OCR enhancement
 */

/**
 * Preprocess an image to improve OCR accuracy
 * Using direct passthrough to avoid any modifications that could alter the image
 */
export async function preprocessImageForOCR(imageUrl: string): Promise<string | null> {
  try {
    devDiagnostics.log('Image preprocessing requested for:', imageUrl);
    
    // Check if we have a valid image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      devDiagnostics.error('Invalid image URL provided:', imageUrl);
      return null;
    }
    
    // Return the original image URL without any modifications
    // This ensures the OCR process sees the exact image as uploaded
    return imageUrl;
  } catch (error) {
    devDiagnostics.error('Error in image preprocessing:', error);
    return null;
  }
}

/**
 * Load an image and get its dimensions
 * This helps with OCR by providing image metadata
 */
export async function getImageDimensions(imageUrl: string): Promise<{width: number, height: number} | null> {
  try {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
      };
      img.onerror = () => {
        devDiagnostics.error('Failed to load image for dimension calculation');
        reject(null);
      };
      img.src = imageUrl;
    });
  } catch (error) {
    devDiagnostics.error('Error getting image dimensions:', error);
    return null;
  }
}
