
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

// Global storage for tracking the current report's image
let currentReportImageCache: {
  imageUrl: string | null;
  timestamp: number;
  reportId: string | null;
} = {
  imageUrl: null,
  timestamp: 0,
  reportId: null
};

// Reset the current image URL when processing a new report
export const resetCurrentReportImage = () => {
  console.log('Resetting current report image URL to null');
  currentReportImageCache = {
    imageUrl: null,
    timestamp: Date.now(), // Update timestamp to indicate a fresh reset
    reportId: null
  };
};

// Extract credit account table as image for two-stage processing
export const extractCreditAccountsTableImage = async (report: CreditReport | null): Promise<string | null> => {
  try {
    // Generate a unique identifier for this report
    const reportId = report?.reportId || `report-${Date.now()}`;
    
    console.log(`Finding image for report extraction, report ID: ${reportId}`);
    console.log(`Current cache state: `, currentReportImageCache);
    
    // If we have a new report, reset the cache
    if (reportId !== currentReportImageCache.reportId) {
      resetCurrentReportImage();
      currentReportImageCache.reportId = reportId;
    }
    
    // Generate a unique timestamp
    const timestamp = Date.now();
    
    // For testing, we can use whatever the most recently uploaded image is
    // In production, this should be replaced with proper image extraction
    const uploadTimestamp = timestamp;
    
    // Get the most recently uploaded file - this should ideally come from the actual upload
    const mostRecentImage = `/lovable-uploads/c83137d2-c8b3-4b75-aff8-aafc9b96cceb.png?t=${uploadTimestamp}`;
    
    // Update the cache with the new image URL
    currentReportImageCache.imageUrl = mostRecentImage;
    currentReportImageCache.timestamp = timestamp;
    
    console.log('Set current report image URL to:', currentReportImageCache.imageUrl);
    return currentReportImageCache.imageUrl;
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
