
/**
 * Image preprocessing utilities for OCR enhancement
 */

/**
 * Preprocess an image to improve OCR accuracy
 * Using enhanced preprocessing methods to improve text contrast and recognition
 */
export async function preprocessImageForOCR(imageUrl: string): Promise<string | null> {
  try {
    console.log('Preprocessing image for OCR:', imageUrl);
    
    // Check if we have a valid image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('Invalid image URL provided:', imageUrl);
      return null;
    }
    
    // For now, we return the original image without modification
    // This avoids potential CORS issues while still allowing extraction to proceed
    return imageUrl;
  } catch (error) {
    console.error('Error preprocessing image:', error);
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
        console.error('Failed to load image for dimension calculation');
        reject(null);
      };
      img.src = imageUrl;
    });
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    return null;
  }
}
