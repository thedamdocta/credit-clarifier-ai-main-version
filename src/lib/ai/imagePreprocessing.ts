
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
    
    // Add cache-busting parameter to ensure we get the latest version of the image
    const cacheBustUrl = imageUrl.includes('?') ? 
      `${imageUrl}&cacheBust=${Date.now()}` : 
      `${imageUrl}?cacheBust=${Date.now()}`;
    
    console.log('Using cache-busted image URL:', cacheBustUrl);
    
    // Return the original image URL without any modifications
    // Just add a cache-busting parameter
    return cacheBustUrl;
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
      img.crossOrigin = "anonymous"; // Add cross-origin attribute for CORS issues
      
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        });
      };
      img.onerror = (e) => {
        console.error('Failed to load image for dimension calculation:', e);
        reject(null);
      };
      
      // Add cache-busting parameter
      const cacheBustUrl = imageUrl.includes('?') ? 
        `${imageUrl}&cacheBust=${Date.now()}` : 
        `${imageUrl}?cacheBust=${Date.now()}`;
      
      img.src = cacheBustUrl;
    });
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    return null;
  }
}
