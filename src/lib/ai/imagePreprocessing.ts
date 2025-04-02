
/**
 * Image preprocessing utilities for OCR enhancement
 * Optimized with compression for better performance
 */

/**
 * Preprocess an image to improve OCR accuracy and performance
 * Applies compression and optimizations for faster processing
 */
export async function preprocessImageForOCR(imageUrl: string): Promise<string | null> {
  try {
    console.log('Starting optimized image preprocessing:', imageUrl);
    
    // Check if we have a valid image URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('Invalid image URL provided:', imageUrl);
      return null;
    }
    
    // Add cache-busting parameter to ensure we get the latest version of the image
    const cacheBustUrl = imageUrl.includes('?') ? 
      `${imageUrl}&cacheBust=${Date.now()}` : 
      `${imageUrl}?cacheBust=${Date.now()}`;
    
    // Compress and optimize the image for faster processing
    const compressedImage = await compressImage(cacheBustUrl, 0.7, 1024);
    if (compressedImage) {
      console.log('Using compressed image for faster processing');
      return compressedImage;
    }
    
    // Fall back to original image if compression fails
    console.log('Using original image URL:', cacheBustUrl);
    return cacheBustUrl;
  } catch (error) {
    console.error('Error in image preprocessing:', error);
    return null;
  }
}

/**
 * Compress an image to reduce size and improve processing speed
 * @param imageUrl The URL of the image to compress
 * @param quality Compression quality (0.0 to 1.0)
 * @param maxDimension Maximum dimension for resizing
 * @returns URL of the compressed image
 */
export async function compressImage(
  imageUrl: string, 
  quality: number = 0.7, 
  maxDimension: number = 1024
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          // Scale down large images for better performance
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round(height * (maxDimension / width));
              width = maxDimension;
            } else {
              width = Math.round(width * (maxDimension / height));
              height = maxDimension;
            }
          }
          
          // Create canvas for resizing and compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('Could not get canvas context');
            resolve(null);
            return;
          }
          
          // Set dimensions and draw image to canvas
          canvas.width = width;
          canvas.height = height;
          
          // Draw with white background for better OCR
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to compressed data URL
          const compressedUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedUrl);
        } catch (error) {
          console.error('Error compressing image:', error);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        console.error('Failed to load image for compression');
        resolve(null);
      };
      
      img.src = imageUrl;
    } catch (error) {
      console.error('Error setting up image compression:', error);
      resolve(null);
    }
  });
}

/**
 * Load an image and get its dimensions
 * Optimized with caching and error handling
 */
export async function getImageDimensions(imageUrl: string): Promise<{width: number, height: number} | null> {
  try {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
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
