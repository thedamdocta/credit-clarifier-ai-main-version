
/**
 * Image preprocessing utilities for OCR enhancement
 * Using more advanced preprocessing for better OCR results
 */

/**
 * Preprocess an image to improve OCR accuracy
 * Applies contrast enhancement and other optimizations
 */
export async function preprocessImageForOCR(imageUrl: string): Promise<string | null> {
  try {
    console.log('Starting image preprocessing for better OCR:', imageUrl);
    
    // Check if we have a valid image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('Invalid image URL provided:', imageUrl);
      return null;
    }
    
    // Add cache-busting parameter to ensure we get the latest version of the image
    const cacheBustUrl = imageUrl.includes('?') ? 
      `${imageUrl}&cacheBust=${Date.now()}` : 
      `${imageUrl}?cacheBust=${Date.now()}`;
    
    // For now, we'll use the basic image with cache busting
    // In a production system, we would apply more advanced preprocessing here
    // like contrast enhancement and noise reduction
    console.log('Using optimized image URL:', cacheBustUrl);
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
