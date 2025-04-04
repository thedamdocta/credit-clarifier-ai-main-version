
/**
 * Utility for converting PDF pages to images for better text extraction
 * Used specifically for the credit account table extraction
 */

/**
 * Convert a PDF page to an image with enhanced quality for table detection
 * @param pdf The PDF document
 * @param pageNum The page number to convert (1-based)
 * @returns A data URL containing the image data
 */
export async function convertPDFPageToImage(pdf: any, pageNum: number): Promise<string | null> {
  try {
    console.log(`Starting page ${pageNum} conversion to image`);
    
    // Get the page
    const page = await pdf.getPage(pageNum);
    
    // Calculate desired dimensions (higher resolution for better OCR)
    // Use an even higher scale factor for better quality
    const scale = 2.0; // Reduced from 4.0 for better performance
    const viewport = page.getViewport({ scale: scale });
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { 
      alpha: false, // Disable alpha for better OCR
      willReadFrequently: true // Optimize for pixel reading
    });
    
    if (!context) {
      console.error("Could not create canvas context");
      return null;
    }
    
    // Set canvas dimensions
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Set white background for better contrast
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render the PDF page to the canvas with high quality settings
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      intent: 'print', // Use print intent for better quality
      background: 'white', // Ensure white background for better text contrast
      renderInteractiveForms: true // Render form fields if present
    };
    
    await page.render(renderContext).promise;
    console.log(`Rendered page ${pageNum} to canvas with dimensions ${canvas.width}x${canvas.height}`);
    
    // Apply enhanced image processing for better OCR
    enhanceImageForOCR(context, canvas.width, canvas.height);
    
    // Convert the canvas to a data URL (JPEG format for smaller size)
    const imageQuality = 0.85; // Higher quality (0-1)
    const imageData = canvas.toDataURL('image/jpeg', imageQuality);
    
    // Add logging for image size to help with debugging
    const dataSizeKB = Math.round(imageData.length / 1024);
    console.log(`Generated image for page ${pageNum}: ${canvas.width}x${canvas.height}, ${dataSizeKB}KB`);
    
    if (imageData.length < 100) {
      console.error(`Error: Generated image for page ${pageNum} is too small (${imageData.length} bytes)`);
      return null;
    }
    
    return imageData;
  } catch (error) {
    console.error(`Error converting page ${pageNum} to image:`, error);
    return null;
  }
}

/**
 * Apply image enhancement techniques to improve OCR accuracy
 * @param context Canvas context of the image
 * @param width Width of the image
 * @param height Height of the image
 */
function enhanceImageForOCR(
  context: CanvasRenderingContext2D, 
  width: number, 
  height: number
): void {
  try {
    // Get image data for processing
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Enhance contrast and apply adaptive thresholding for better OCR readability
    for (let i = 0; i < data.length; i += 4) {
      // Calculate grayscale value
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      
      // Apply thresholding specifically optimized for text and numbers
      // This makes text and numbers more distinct from the background
      let value;
      if (avg > 180) {
        // Definitely background - make it pure white
        value = 255;
      } else if (avg < 120) {
        // Definitely text/numbers - make it pure black
        value = 0;
      } else {
        // For the middle range values, enhance contrast even more
        // for better table structure detection
        value = avg < 150 ? 0 : 255;
      }
      
      // Apply the new value to RGB channels
      data[i] = value;     // R
      data[i + 1] = value; // G
      data[i + 2] = value; // B
      // Don't modify Alpha channel (data[i + 3])
    }
    
    // Put the modified data back
    context.putImageData(imageData, 0, 0);
    
    console.log("Applied enhanced image processing for better OCR");
  } catch (error) {
    console.error("Error applying image enhancement:", error);
    // Continue with original image if enhancement fails
  }
}

/**
 * Process a specific region of a PDF page
 * Useful for targeted extraction of tables or other structured data
 */
export async function extractRegionFromPDFPage(
  pdf: any, 
  pageNum: number, 
  region: { x: number, y: number, width: number, height: number }
): Promise<string | null> {
  try {
    // Get the base image first
    const imageData = await convertPDFPageToImage(pdf, pageNum);
    if (!imageData) return null;
    
    // Load the image into a temporary image element
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageData;
    });
    
    // Create a canvas for the cropped region
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error("Could not create canvas context for region extraction");
      return null;
    }
    
    // Set canvas to region size
    canvas.width = region.width;
    canvas.height = region.height;
    
    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw the selected region to the canvas
    ctx.drawImage(
      img,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );
    
    // Apply additional enhancement for the specific region
    enhanceImageForOCR(ctx, canvas.width, canvas.height);
    
    // Convert the region to a data URL
    return canvas.toDataURL('image/png', 1.0);
  } catch (error) {
    console.error(`Error extracting region from page ${pageNum}:`, error);
    return null;
  }
}
