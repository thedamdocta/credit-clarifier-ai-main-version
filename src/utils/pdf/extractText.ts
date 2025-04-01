
// Import the function for PDF to image conversion
import { convertPDFPageToImage } from './pdfToImage';

// Global storage for the current PDF being processed
let currentPdfData: {
  pdfFile?: File;
  pdfDocument?: any;
  reportId?: string;
  parsedReport?: any;
  fileName?: string;
  extractedText?: string;
  tableImageUrl?: string; // Added to store table image URL
} = {};

// Cache for extracted report data - prevents overriding with sample data
let extractedReportData: any = null;

// Generate and set a unique ID for the current PDF document
export const setCurrentPDFData = (file: File): string => {
  const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  currentPdfData = {
    pdfFile: file,
    reportId,
    fileName: file.name
  };
  return reportId;
};

// Store the parsed report data
export const setExtractedReportData = (parsedReport: any) => {
  extractedReportData = parsedReport;
};

// Get the extracted report data
export const getExtractedReportData = () => {
  return extractedReportData;
};

// Reset the current report image
export const resetCurrentReportImage = () => {
  if (currentPdfData && currentPdfData.tableImageUrl) {
    currentPdfData.tableImageUrl = undefined;
  }
};

/**
 * Extract text from the PDF document
 * @param pdfDocument The PDF document to extract text from
 * @returns A promise resolving to the extracted text
 */
export const extractTextFromPDF = async (pdfDocument: any): Promise<string> => {
  try {
    // Store reference to the PDF document for use in other functions
    currentPdfData.pdfDocument = pdfDocument;
    
    const numPages = pdfDocument.numPages;
    let fullText = "";
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + " ";
    }
    
    // Store the extracted text for later use
    currentPdfData.extractedText = fullText;
    
    // Return the full text
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return "";
  }
};

/**
 * Extract the credit accounts table image from the PDF
 * This uses image-based extraction specifically for the account table
 */
export const extractCreditAccountsTableImage = async (report: any): Promise<string | null> => {
  try {
    console.log("Attempting to extract credit accounts table image");
    
    // If we already have a table image URL cached, return it
    if (currentPdfData.tableImageUrl) {
      console.log("Using cached table image URL");
      return currentPdfData.tableImageUrl;
    }
    
    // If no PDF document is available, we can't extract an image
    if (!currentPdfData.pdfDocument) {
      console.error("No PDF document available for image extraction");
      return null;
    }
    
    const pdfDocument = currentPdfData.pdfDocument;
    const numPages = pdfDocument.numPages;
    
    // First, try to find which page contains the account table
    // We'll look for the page that has the most occurrences of relevant table keywords
    let bestPageScore = 0;
    let bestPageNum = 0;
    
    // Check which pages might contain the account table
    console.log("Scanning PDF pages for credit accounts table...");
    for (let i = 1; i <= Math.min(numPages, 10); i++) { // Check first 10 pages at most
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
        
        // Keywords that indicate this might be the accounts page
        const keywords = [
          'account summary', 'credit accounts', 'account type', 'revolving',
          'mortgage', 'installment', 'with balance', 'total balance'
        ];
        
        // Calculate a score for this page
        let score = 0;
        keywords.forEach(keyword => {
          if (pageText.includes(keyword.toLowerCase())) {
            score += 1;
          }
        });
        
        console.log(`Page ${i} table keyword score: ${score}`);
        
        // If this page has a better score, update our best page
        if (score > bestPageScore) {
          bestPageScore = score;
          bestPageNum = i;
        }
        
        // Optimization: If we found a page with many keywords, use it immediately
        if (score >= 4) {
          console.log(`Found likely table page at page ${i} with high score: ${score}`);
          break;
        }
      } catch (error) {
        console.error(`Error scanning page ${i}:`, error);
      }
    }
    
    // If we found a page with some keywords, try to extract it
    if (bestPageNum > 0) {
      console.log(`Attempting to extract table from best matched page ${bestPageNum} with score ${bestPageScore}`);
      const imageData = await convertPDFPageToImage(pdfDocument, bestPageNum);
      
      if (imageData) {
        console.log(`Successfully extracted image from page ${bestPageNum}`);
        // Store this image URL
        currentPdfData.tableImageUrl = imageData;
        return imageData;
      }
    }
    
    // If we couldn't find a good match, try a comprehensive scan of all pages
    console.log("No good keyword match found, attempting extraction from all pages");
    
    // Try the first 5 pages as fallback
    for (let i = 1; i <= Math.min(numPages, 5); i++) {
      try {
        console.log(`Fallback: extracting image from page ${i}`);
        const imageData = await convertPDFPageToImage(pdfDocument, i);
        
        if (imageData) {
          // Store this image URL
          currentPdfData.tableImageUrl = imageData;
          return imageData;
        }
      } catch (error) {
        console.error(`Error extracting image from page ${i}:`, error);
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting credit accounts table image:", error);
    return null;
  }
};
