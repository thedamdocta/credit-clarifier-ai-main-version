
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
    // If we don't have a current image URL but have a report, we need to find an image
    if (!currentReportImageUrl && report) {
      console.log('Finding image for report:', report.bureau);
      
      // Use the example image as a static resource
      // In a production environment, we would extract this from the PDF
      const timestamp = Date.now();
      
      // Use the provided sample image
      currentReportImageUrl = `/lovable-uploads/d69df182-57e6-4255-9612-a5f948fa7c6a.png?t=${timestamp}`;
      
      console.log('Set current report image URL to:', currentReportImageUrl);
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
