
/**
 * Image preprocessing utilities for OCR enhancement
 * Modified to avoid altering data in any way
 */

/**
 * Preprocess an image to improve OCR accuracy
 * Direct passthrough with no modifications to avoid altering the data
 */
export async function preprocessImageForOCR(imageUrl: string): Promise<string | null> {
  try {
    console.log('Image preprocessing requested - using direct passthrough:', imageUrl);
    
    // Check if we have a valid image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('Invalid image URL provided:', imageUrl);
      return null;
    }
    
    // Return the original image URL without any modifications
    // This ensures the OCR process sees the exact image as uploaded
    return imageUrl;
  } catch (error) {
    console.error('Error in image preprocessing:', error);
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
