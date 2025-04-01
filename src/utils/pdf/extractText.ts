
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
  currentPDFData = {
    imageUrl: null, // Will be set when image is extracted
    timestamp: Date.now(),
    uploadedFile: file,
    reportId: `report-${Date.now()}-${file.name.replace(/\W/g, '')}`
  };
  
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
    // Generate a unique identifier for this report
    const reportId = report?.reportId || `report-${Date.now()}`;
    
    console.log(`Finding image for report extraction, report ID: ${reportId}`);
    console.log(`Current cache state: `, currentPDFData);
    
    // Check if we have an image URL already cached for this upload
    if (currentPDFData.imageUrl) {
      console.log('Using cached image URL with timestamp:', currentPDFData.timestamp);
      
      // Add a cache-busting timestamp to ensure we get a fresh image
      const cachedUrl = currentPDFData.imageUrl;
      const cacheBustedUrl = cachedUrl.includes('?') ? 
        `${cachedUrl}&t=${Date.now()}` : 
        `${cachedUrl}?t=${Date.now()}`;
        
      return cacheBustedUrl;
    }
    
    // If we have an uploadedImage from a user upload (in production this would be from the most recent PDF page)
    const uploadedImage = document.querySelector('img[src^="/lovable-uploads/"]');
    
    if (uploadedImage) {
      const imgSrc = uploadedImage.getAttribute('src');
      if (imgSrc) {
        console.log('Found uploaded image:', imgSrc);
        currentPDFData.imageUrl = imgSrc;
        
        // Add cache-busting timestamp
        const cacheBustedUrl = imgSrc.includes('?') ? 
          `${imgSrc}&t=${Date.now()}` : 
          `${imgSrc}?t=${Date.now()}`;
          
        return cacheBustedUrl;
      }
    }
    
    // If no image is found, check for the most recent file upload in the form
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      console.log('Found file input with files, but no uploaded image is available yet');
      // In a real implementation, we would process this file to extract the image
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
