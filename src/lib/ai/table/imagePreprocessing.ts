
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
    
    // For demonstration, we're using browser-based image processing
    // In a production app, this could use more advanced server-side processing
    if (typeof window !== 'undefined' && window.document) {
      return await browserBasedImagePreprocessing(imageUrl);
    }
    
    // Simulate processing time if not in browser
    await new Promise(resolve => setTimeout(resolve, 100));
    return imageUrl;
  } catch (error) {
    console.error('Error preprocessing image:', error);
    return null;
  }
}

/**
 * Browser-based image preprocessing using canvas
 */
async function browserBasedImagePreprocessing(imageUrl: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      
      img.onload = () => {
        try {
          // Create a canvas element
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.error('Could not get canvas context');
            resolve(imageUrl);
            return;
          }
          
          // Set canvas dimensions to match image
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw the original image
          ctx.drawImage(img, 0, 0);
          
          // Get the image data for processing
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Apply image processing techniques:
          
          // 1. Convert to grayscale (better for text recognition)
          for (let i = 0; i < data.length; i += 4) {
            const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
            data[i] = brightness;     // R
            data[i + 1] = brightness; // G
            data[i + 2] = brightness; // B
          }
          
          // 2. Increase contrast
          const contrastFactor = 1.5; // Adjust as needed
          for (let i = 0; i < data.length; i += 4) {
            const factor = (259 * (contrastFactor + 255)) / (255 * (259 - contrastFactor));
            data[i] = factor * (data[i] - 128) + 128;     // R
            data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
            data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
          }
          
          // 3. Apply thresholding to make text more distinct (binarization)
          const threshold = 150; // Adjust threshold level as needed
          for (let i = 0; i < data.length; i += 4) {
            const value = data[i] > threshold ? 255 : 0;
            data[i] = value;     // R
            data[i + 1] = value; // G
            data[i + 2] = value; // B
          }
          
          // Put processed image data back on canvas
          ctx.putImageData(imageData, 0, 0);
          
          // Convert canvas back to image URL (data URL)
          const processedImageUrl = canvas.toDataURL('image/png');
          
          console.log('Image preprocessing complete');
          resolve(processedImageUrl);
        } catch (canvasError) {
          console.error('Error in canvas processing:', canvasError);
          resolve(imageUrl); // Fall back to original image
        }
      };
      
      img.onerror = (err) => {
        console.error('Error loading image for preprocessing:', err);
        resolve(imageUrl); // Fall back to original image
      };
      
      // Start loading the image
      img.src = imageUrl;
      
    } catch (error) {
      console.error('Error in browser image preprocessing:', error);
      resolve(imageUrl); // Fall back to original image
    }
  });
}
