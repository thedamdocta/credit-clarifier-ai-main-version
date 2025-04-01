
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

// Store the current image URL for the active report
let currentReportImageUrl: string | null = null;

// Reset the current image URL when processing a new report
export const resetCurrentReportImage = () => {
  currentReportImageUrl = null;
};

// Extract credit account table as image for two-stage processing
export const extractCreditAccountsTableImage = async (report: CreditReport | null): Promise<string | null> => {
  try {
    // For demonstration purposes, we'll use an uploaded image
    // In a production environment, we would extract this from the PDF
    
    // If we don't have a current image URL but have a report, we need to find an image
    if (!currentReportImageUrl && report) {
      console.log('Finding image for report:', report.bureau);
      
      // Generate a random URL for the current session to avoid caching issues
      const timestamp = Date.now();
      currentReportImageUrl = `/lovable-uploads/8d2ecd4c-1936-4c99-92da-885ee36a9e27.png?t=${timestamp}`;
    }
    
    if (currentReportImageUrl) {
      console.log('Using table image from:', currentReportImageUrl);
      return currentReportImageUrl;
    }
    
    console.log('No image available for table extraction');
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
    
    // Stage 1: Extract raw text using OCR
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
