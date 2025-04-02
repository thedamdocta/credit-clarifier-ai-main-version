
/**
 * Utility for converting PDF pages to images for better text extraction
 * Used specifically for the credit account table extraction
 */

/**
 * Convert a PDF page to an image
 * @param pdf The PDF document
 * @param pageNum The page number to convert (1-based)
 * @returns A data URL containing the image data
 */
export async function convertPDFPageToImage(pdf: any, pageNum: number): Promise<string | null> {
  try {
    // Get the page
    const page = await pdf.getPage(pageNum);
    
    // Calculate desired dimensions (higher resolution for better OCR)
    const viewport = page.getViewport({ scale: 2.5 }); // Increased scale for better resolution
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false }); // Disable alpha for better OCR
    
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
    
    // Render the PDF page to the canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      intent: 'print' // Use print intent for better quality
    };
    
    await page.render(renderContext).promise;
    console.log(`Rendered page ${pageNum} to canvas with dimensions ${canvas.width}x${canvas.height}`);
    
    // Convert the canvas to a data URL (PNG format)
    // Using PNG for lossless quality which is better for OCR
    const imageData = canvas.toDataURL('image/png', 1.0);
    return imageData;
  } catch (error) {
    console.error(`Error converting page ${pageNum} to image:`, error);
    return null;
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
    
    // Convert the region to a data URL
    return canvas.toDataURL('image/png', 1.0);
  } catch (error) {
    console.error(`Error extracting region from page ${pageNum}:`, error);
    return null;
  }
}
