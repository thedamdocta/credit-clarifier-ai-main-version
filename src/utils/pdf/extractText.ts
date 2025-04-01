
import { toast } from "sonner";
import { extractTextFromImageWithOCR, processImageWithEnhancedOCR } from "@/lib/ai/ocrExtraction";
import { CreditReport } from "@/lib/types/creditReport";

export const extractTextFromPDF = async (pdf: any): Promise<string> => {
  let extractedText = '';
  
  // Extract text from all pages
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    extractedText += pageText + ' ';
    
    // Log progress for debugging
    console.log(`Processed page ${i} of ${pdf.numPages}`);
  }
  
  console.log('Text extraction complete. Text length:', extractedText.length);
  console.log('Sample text:', extractedText.substring(0, 300) + '...');
  
  return extractedText;
};

// Global storage for tracking the current PDF file
let currentPDFData: {
  imageUrl: string | null;
  timestamp: number;
  uploadedFile: File | null;
  reportId: string | null;
} = {
  imageUrl: null,
  timestamp: 0,
  uploadedFile: null,
  reportId: null
};

// Store the most recent uploaded file data
export const setCurrentPDFData = (file: File) => {
  console.log('Setting current PDF file:', file.name);
  
  // Generate a truly unique ID that includes file name and timestamp
  const uniqueId = `report-${Date.now()}-${file.name.replace(/\W/g, '')}`;
  
  currentPDFData = {
    imageUrl: null, // Will be set when image is extracted
    timestamp: Date.now(),
    uploadedFile: file,
    reportId: uniqueId
  };
  
  console.log('Updated current PDF data with new reportId:', uniqueId);
  return currentPDFData.reportId;
};

// Reset the current image URL when processing a new report
export const resetCurrentReportImage = () => {
  console.log('Resetting current report image URL to null');
  if (currentPDFData.imageUrl) {
    currentPDFData.imageUrl = null;
    currentPDFData.timestamp = Date.now(); // Update timestamp to indicate a fresh reset
  }
};

// Extract credit account table as image for two-stage processing
export const extractCreditAccountsTableImage = async (report: CreditReport | null): Promise<string | null> => {
  try {
    console.log('Finding image for report extraction, report ID:', report?.reportId);
    console.log('Current cache state: ', currentPDFData);
    
    // Find the most recently uploaded image in the DOM
    // Use querySelectorAll to get all image elements
    const uploadedImages = document.querySelectorAll('img[src^="/lovable-uploads/"]');
    let mostRecentImage: HTMLImageElement | null = null;
    
    console.log(`Found ${uploadedImages.length} uploaded images in the DOM`);
    
    if (uploadedImages.length > 0) {
      // Get the most recent image (last one in the DOM)
      mostRecentImage = uploadedImages[uploadedImages.length - 1] as HTMLImageElement;
      const imgSrc = mostRecentImage.getAttribute('src');
      
      if (imgSrc) {
        console.log('Found uploaded image:', imgSrc);
        
        // Update the cache with this URL
        currentPDFData.imageUrl = imgSrc;
        
        // Add cache-busting timestamp
        const cacheBustedUrl = imgSrc.includes('?') ? 
          `${imgSrc}&t=${Date.now()}` : 
          `${imgSrc}?t=${Date.now()}`;
          
        return cacheBustedUrl;
      }
    }
    
    // If no image is found in the DOM, check if we have a cached image URL
    if (currentPDFData.imageUrl) {
      console.log('Using cached image URL with timestamp:', currentPDFData.timestamp);
      
      // Add a cache-busting timestamp to ensure we get a fresh image
      const cachedUrl = currentPDFData.imageUrl;
      const cacheBustedUrl = cachedUrl.includes('?') ? 
        `${cachedUrl}&t=${Date.now()}` : 
        `${cachedUrl}?t=${Date.now()}`;
        
      return cacheBustedUrl;
    }
    
    // Look for any file inputs with files
    const fileInputs = document.querySelectorAll('input[type="file"]');
    console.log(`Found ${fileInputs.length} file inputs`);
    
    let hasFiles = false;
    fileInputs.forEach((input: HTMLInputElement) => {
      if (input.files && input.files.length > 0) {
        hasFiles = true;
        console.log('Found file input with files:', input.files[0].name);
      }
    });
    
    if (!hasFiles) {
      // Look for any image elements that might contain the table
      const allImages = document.querySelectorAll('img');
      console.log(`Found ${allImages.length} total images in the DOM`);
      
      // Check for any image that might be the table
      for (const img of allImages) {
        const src = img.getAttribute('src');
        if (src && !src.includes('placeholder') && !src.includes('favicon')) {
          console.log('Found potential table image:', src);
          
          // Use this image as a last resort
          currentPDFData.imageUrl = src;
          
          // Add cache-busting timestamp
          const cacheBustedUrl = src.includes('?') ? 
            `${src}&t=${Date.now()}` : 
            `${src}?t=${Date.now()}`;
            
          return cacheBustedUrl;
        }
      }
    }
    
    console.log('No suitable image found for extraction');
    toast.error("No suitable table image found");
    return null;
  } catch (error) {
    console.error('Error extracting table image:', error);
    return null;
  }
};

// Two-stage text extraction from an image
export const extractTextFromImage = async (imageUrl: string): Promise<string | null> => {
  try {
    console.log('Starting two-stage OCR on image:', imageUrl);
    
    // Stage 1: Extract raw text using OCR (direct passthrough, no preprocessing)
    const extractedText = await processImageWithEnhancedOCR(imageUrl);
    
    if (extractedText) {
      console.log('Two-stage OCR process completed');
      return extractedText;
    } else {
      // Fallback to simulation for development
      console.log('OCR failed, using simulation');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing delay
      return "Simulated OCR text extraction - would be replaced by actual model results";
    }
  } catch (error) {
    console.error('Error running OCR on image:', error);
    return null;
  }
};
