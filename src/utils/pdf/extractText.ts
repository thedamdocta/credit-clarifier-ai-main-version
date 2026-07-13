
// Global storage for the current PDF being processed
let currentPdfData: {
  pdfFile?: File;
  pdfDocument?: any;
  reportId?: string;
  parsedReport?: any;
  fileName?: string;
  extractedText?: string;
  tableImageUrl?: string; 
  targetTable?: string; // Add targetTable to the interface
  pageTextOffsets?: Array<{ page: number; start: number; end: number }>;
} = {};

// Import the function for PDF to image conversion
import { convertPDFPageToImage } from './pdfToImage';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

// Cache for extracted report data - prevents overriding with sample data
let extractedReportData: any = null;

// Generate and set a unique ID for the current PDF document
export const setCurrentPDFData = (file: File, options?: { targetTable?: string }): string => {
  const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  currentPdfData = {
    pdfFile: file,
    reportId,
    fileName: file.name,
    targetTable: options?.targetTable
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

export const getCurrentPdfDocument = () => currentPdfData.pdfDocument;

export const getCurrentPdfPageOffsets = () => currentPdfData.pageTextOffsets ?? [];

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
    currentPdfData.pageTextOffsets = [];
    
    const numPages = pdfDocument.numPages;
    let fullText = "";
    
    for (let i = 1; i <= numPages; i++) {
      const pageStart = fullText.length;
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + " ";
      const pageEnd = fullText.length;
      currentPdfData.pageTextOffsets?.push({
        page: i,
        start: pageStart,
        end: pageEnd
      });
    }
    
    // Store the extracted text for later use
    currentPdfData.extractedText = fullText;
    
    // Return the full text
    return fullText;
  } catch (error) {
    devDiagnostics.error("Error extracting text from PDF:", error);
    return "";
  }
};

/**
 * Extract the credit accounts table image from the PDF
 * This uses image-based extraction specifically for the account table
 */
export const extractCreditAccountsTableImage = async (report: any): Promise<string | null> => {
  try {
    devDiagnostics.log("Attempting to extract credit accounts table image");
    
    // If we already have a table image URL cached, return it
    if (currentPdfData.tableImageUrl) {
      devDiagnostics.log("Using cached table image URL");
      return currentPdfData.tableImageUrl;
    }
    
    // If no PDF document is available, we can't extract an image
    if (!currentPdfData.pdfDocument) {
      devDiagnostics.error("No PDF document available for image extraction");
      return null;
    }
    
    const pdfDocument = currentPdfData.pdfDocument;
    const numPages = pdfDocument.numPages;
    
    // Enhanced list of keywords to better identify the credit accounts table
    // Added more specific phrases that would appear in the Credit Accounts section
    const tableKeywords = [
      'credit accounts',
      'account type', 
      'revolving', 
      'mortgage', 
      'installment', 
      'total balance',
      'with balance',
      'debt-to-credit',
      'payment',
      'available'
    ];
    
    // First, try to find which page contains "Credit Accounts" header specifically
    let creditAccountsPage = -1;
    let highestScore = 0;
    
    // Check each page for "Credit Accounts" header
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
        
        // Explicitly check for "Credit Accounts" header
        if (pageText.includes("credit accounts")) {
          devDiagnostics.log(`Found "Credit Accounts" header on page ${i}`);
          
          // Count occurrences of other table keywords to confirm it's the right table
          let score = 100; // Give high base score for "Credit Accounts" heading
          
          tableKeywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            const matches = pageText.match(regex);
            if (matches) {
              score += matches.length;
            }
          });
          
          // Check for specific patterns that indicate an account summary table
          if (/(revolving|mortgage|installment).*?\d+.*?(balance|open)/i.test(pageText)) {
            score += 50; // Very strong indicator of the right table
          }
          
          // Look for column headers typical in account summary tables
          if (/account\s+type.*open.*with\s+balance.*total\s+balance/i.test(pageText)) {
            score += 75; // Almost definitely the right table
          }
          
          devDiagnostics.log(`Page ${i} score for credit accounts table: ${score}`);
          
          // If this page has the highest score, use it
          if (score > highestScore) {
            highestScore = score;
            creditAccountsPage = i;
          }
        }
      } catch (error) {
        devDiagnostics.error(`Error analyzing page ${i}:`, error);
      }
    }
    
    // If we didn't find a page with "Credit Accounts", fall back to keyword scoring
    if (creditAccountsPage === -1) {
      devDiagnostics.log("No page with explicit 'Credit Accounts' header found, falling back to keyword analysis");
      
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
            score += 20; // Boost score for typical table content
          }
          
          // Look for column headers typical in account summary tables
          if (/account\s+type.*open.*with\s+balance.*total\s+balance/i.test(pageText)) {
            score += 30; // Strong indicator of the account table
          }
          
          // Look for tabular structure with account types and numbers
          if (/revolving.*?\d+.*?mortgage.*?\d+.*?installment.*?\d+/i.test(pageText)) {
            score += 25; // Very strong indicator of the account table
          }
          
          devDiagnostics.log(`Page ${i} score for credit account table detection: ${score}`);
          
          // Update best page if this one has a higher score
          if (score > highestScore) {
            highestScore = score;
            creditAccountsPage = i;
          }
        } catch (error) {
          devDiagnostics.error(`Error processing page ${i} for table detection:`, error);
        }
      }
    }
    
    devDiagnostics.log(`Best page for credit account table: ${creditAccountsPage} with score ${highestScore}`);
    
    // If no good page was found, return null
    if (creditAccountsPage === -1 || highestScore < 10) {
      devDiagnostics.log("No good page found for credit account table extraction");
      return null;
    }
    
    // Extract the image of the best page
    try {
      const pageImage = await convertPDFPageToImage(pdfDocument, creditAccountsPage);
      
      if (!pageImage) {
        devDiagnostics.error("Failed to convert page to image for table extraction");
        return null;
      }
      
      devDiagnostics.log(`Successfully extracted image for page ${creditAccountsPage}`);
      
      // Store the image URL in the current PDF data
      currentPdfData.tableImageUrl = pageImage;
      
      return pageImage;
    } catch (error) {
      devDiagnostics.error("Error extracting table image:", error);
      return null;
    }
  } catch (error) {
    devDiagnostics.error("Error extracting credit accounts table image:", error);
    return null;
  }
};
