
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
    const tableKeywords = ['account type', 'open', 'with balance', 'total balance', 'revolving', 'mortgage', 'installment'];
    const lines = extractedText.split('\n');
    
    // For each line, check if it contains the table keywords
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      let score = 0;
      
      tableKeywords.forEach(keyword => {
        if (line.includes(keyword)) {
          score += 1;
        }
      });
      
      if (score >= 3) {
        console.log(`Found likely table line: "${line}" with score ${score}`);
        
        // We found a line that likely contains the table header
        // Now we need to convert this page to an image
        // Since we don't know which page this line is from, we'll have to try each page
        break;
      }
    }
    
    // If we couldn't determine the page from text, scan all pages
    // Start from page 2, as it's often on the second page
    for (let i = 2; i <= Math.min(numPages, 5); i++) {
      try {
        console.log(`Attempting to extract table image from page ${i}`);
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
    
    // If all attempts fail, try page 1
    try {
      console.log("Attempting to extract table image from page 1 as fallback");
      const imageData = await convertPDFPageToImage(pdfDocument, 1);
      if (imageData) {
        currentPdfData.tableImageUrl = imageData;
        return imageData;
      }
    } catch (error) {
      console.error("Error extracting image from page 1:", error);
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting credit accounts table image:", error);
    return null;
  }
};
