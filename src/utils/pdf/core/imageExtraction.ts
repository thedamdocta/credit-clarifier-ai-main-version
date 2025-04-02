
// PDF image extraction helper functions
import { convertPDFPageToImage } from "../pdfToImage";

// Function to attempt extracting the first page as image
export async function attemptExtractFirstPageImage(pdf: any): Promise<string | null> {
  try {
    console.log("Extracting images from PDF for OCR processing");
    
    // Store PDF data for later use in image extraction
    if (window) {
      window.currentPdf = pdf;
    }
    
    const imageExtractionPromise = async () => {
      try {
        return await Promise.race([
          convertPDFPageToImage(pdf, 1),
          new Promise<string | null>(resolve => setTimeout(() => {
            console.log("Image extraction taking too long, continuing process");
            resolve(null);
          }, 10000)) // 10s timeout for image extraction
        ]);
      } catch (error) {
        console.error("Image extraction error:", error);
        return null;
      }
    };
    
    const firstPageImage = await imageExtractionPromise();
    
    if (firstPageImage) {
      console.log("Successfully extracted first page as image");
      
      // Store image data for later use
      if (window) {
        window.currentPdfPageImages = [firstPageImage];
      }
    }
    
    return firstPageImage;
  } catch (error) {
    console.error("Error extracting images from PDF:", error);
    return null;
  }
}
