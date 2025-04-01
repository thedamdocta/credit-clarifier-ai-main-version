
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
  extractedData: any | null; // Store extracted data to prevent overwriting with sample data
} = {
  imageUrl: null,
  timestamp: 0,
  uploadedFile: null,
  reportId: null,
  extractedData: null
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
    reportId: uniqueId,
    extractedData: null // Reset extracted data for new file
  };
  
  console.log('Updated current PDF data with new reportId:', uniqueId);
  return currentPDFData.reportId;
};

// Set extracted data when it's actually obtained from a real file
export const setExtractedReportData = (data: any) => {
  if (data && currentPDFData) {
    console.log('Storing actual extracted data for report:', currentPDFData.reportId);
    currentPDFData.extractedData = data;
    return true;
  }
  return false;
};

// Get extracted data if we have it
export const getExtractedReportData = () => {
  return currentPDFData?.extractedData || null;
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
    
    // IMPROVED: Check more broadly for uploaded images in the DOM
    const uploadedImagesSelector = 'img[src*="lovable-uploads/"], img[src*="/lovable-uploads/"]';
    const uploadedImages = document.querySelectorAll(uploadedImagesSelector);
    console.log(`Found ${uploadedImages.length} uploaded images in the DOM using broader selector: ${uploadedImagesSelector}`);
    
    if (uploadedImages.length > 0) {
      // Get the most recent image (last one in the DOM)
      const mostRecentImage = uploadedImages[uploadedImages.length - 1] as HTMLImageElement;
      const imgSrc = mostRecentImage.getAttribute('src');
      
      if (imgSrc) {
        console.log('Found uploaded image:', imgSrc);
        
        // Update the cache with this URL
        currentPDFData.imageUrl = imgSrc;
        
        // Add cache-busting timestamp
        const cacheBustedUrl = imgSrc.includes('?') ? 
          `${imgSrc}&t=${Date.now()}` : 
          `${imgSrc}?t=${Date.now()}`;
          
        console.log('Using actual uploaded image:', cacheBustedUrl);
        return cacheBustedUrl;
      }
    }
    
    // If no image is found in the DOM, use the fallback: embedded test image
    const testImages = [
      "/lovable-uploads/3f5da6bd-b94e-4b22-91f1-cfe0d84e2f12.png",
      "/lovable-uploads/a0a9c72b-ad0d-4dce-9e0e-46dccfbb2bb0.png",
      "/lovable-uploads/1488cf26-6a12-4b97-b614-866ade912179.png"
    ];
    
    // Check if any of these test images exist in the DOM
    for (const testImage of testImages) {
      const testCheck = document.querySelector(`img[src="${testImage}"], img[src^="${testImage}"]`);
      if (testCheck) {
        console.log('Found test image in the DOM:', testImage);
        currentPDFData.imageUrl = testImage;
        return `${testImage}?t=${Date.now()}`;
      }
    }
    
    // If we have a cached image URL from a previous extraction
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
    
    // Final fallback: check for any images in the DOM
    console.log('Checking for any valid images in the DOM as last resort');
    const allImages = document.querySelectorAll('img');
    console.log(`Found ${allImages.length} total images in the DOM`);
    
    for (const img of allImages) {
      const src = img.getAttribute('src');
      if (src && (src.includes('lovable-uploads') || src.includes('credit') || src.includes('report'))) {
        console.log('Found potentially relevant image:', src);
        currentPDFData.imageUrl = src;
        return `${src}?t=${Date.now()}`;
      }
    }
    
    console.log('No suitable image found for extraction, enabling simulation mode');
    return null;
  } catch (error) {
    console.error('Error finding image for extraction:', error);
    return null;
  }
};
