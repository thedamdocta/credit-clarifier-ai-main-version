
// Global storage for the current PDF being processed
let currentPdfData: {
  pdfFile?: File;
  pdfDocument?: any;
  reportId?: string;
  parsedReport?: any;
  fileName?: string;
  extractedText?: string;
  tableImageUrl?: string; 
} = {};

// Import the function for PDF to image conversion
import { convertPDFPageToImage } from './pdfToImage';

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
    let bestPage = 1;
    let highestScore = 0;
    
    // Check which pages have already been extracted as text
    const extractedText = currentPdfData.extractedText || "";
    
    // Use the extracted text to help locate the account table page
    // Enhanced list of keywords to better identify the credit accounts table
    const tableKeywords = [
      'account type', 'revolving', 'mortgage', 'installment', 'total balance', 
      'credit limit', 'payment', 'debt-to-credit', 'with balance', 'open',
      'credit accounts', 'account summary', 'summary of accounts'
    ];
    
    // Process each page to find the one with the account table
    for (let i = 1; i <= numPages; i++) {
      try {
        // Get the page text content
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
        
        // Count occurrences of table keywords
        let score = 0;
        tableKeywords.forEach(keyword => {
          const regex = new RegExp(keyword, 'gi');
          const matches = pageText.match(regex);
          if (matches) {
            score += matches.length;
          }
        });
        
        // Extra score for specific patterns that strongly indicate the account table
        if (/(revolving|mortgage|installment).*?\d+.*?balance/i.test(pageText)) {
          score += 10; // Boost score for typical table content
        }
        
        // Look for tabular structure with account types and numbers
        if (/revolving.*?\d+.*?mortgage.*?\d+.*?installment.*?\d+/i.test(pageText)) {
          score += 15; // Very strong indicator of the account table
        }
        
        console.log(`Page ${i} score: ${score} for credit account table detection`);
        
        // Update best page if this one has a higher score
        if (score > highestScore) {
          highestScore = score;
          bestPage = i;
        }
      } catch (error) {
        console.error(`Error processing page ${i} for table detection:`, error);
      }
    }
    
    console.log(`Best page for credit account table: ${bestPage} with score ${highestScore}`);
    
    // If no good page was found, return null
    if (highestScore < 2) {
      console.log("No good page found for credit account table extraction");
      return null;
    }
    
    // Extract the image of the best page
    try {
      const pageImage = await convertPDFPageToImage(pdfDocument, bestPage);
      
      if (!pageImage) {
        console.error("Failed to convert page to image for table extraction");
        return null;
      }
      
      console.log(`Successfully extracted image for page ${bestPage}`);
      
      // Store the image URL in the current PDF data
      currentPdfData.tableImageUrl = pageImage;
      
      return pageImage;
    } catch (error) {
      console.error("Error extracting table image:", error);
      return null;
    }
  } catch (error) {
    console.error("Error extracting credit accounts table image:", error);
    return null;
  }
};
