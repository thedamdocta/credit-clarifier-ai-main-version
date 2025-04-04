
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
  collectionTableImageUrl?: string; // Add property for collection table image
} = {};

// Import the function for PDF to image conversion
import { convertPDFPageToImage } from './pdfToImage';

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

// Add getCurrentPDFData export to fix the error
export const getCurrentPDFData = () => {
  return currentPdfData;
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

// Reset the current collection image
export const resetCurrentCollectionImage = () => {
  if (currentPdfData && currentPdfData.collectionTableImageUrl) {
    currentPdfData.collectionTableImageUrl = undefined;
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
          console.log(`Found "Credit Accounts" header on page ${i}`);
          
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
          
          console.log(`Page ${i} score for credit accounts table: ${score}`);
          
          // If this page has the highest score, use it
          if (score > highestScore) {
            highestScore = score;
            creditAccountsPage = i;
          }
        }
      } catch (error) {
        console.error(`Error analyzing page ${i}:`, error);
      }
    }
    
    // If we didn't find a page with "Credit Accounts", fall back to keyword scoring
    if (creditAccountsPage === -1) {
      console.log("No page with explicit 'Credit Accounts' header found, falling back to keyword analysis");
      
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
          
          console.log(`Page ${i} score for credit account table detection: ${score}`);
          
          // Update best page if this one has a higher score
          if (score > highestScore) {
            highestScore = score;
            creditAccountsPage = i;
          }
        } catch (error) {
          console.error(`Error processing page ${i} for table detection:`, error);
        }
      }
    }
    
    console.log(`Best page for credit account table: ${creditAccountsPage} with score ${highestScore}`);
    
    // If no good page was found, return null
    if (creditAccountsPage === -1 || highestScore < 10) {
      console.log("No good page found for credit account table extraction");
      return null;
    }
    
    // Extract the image of the best page
    try {
      const pageImage = await convertPDFPageToImage(pdfDocument, creditAccountsPage);
      
      if (!pageImage) {
        console.error("Failed to convert page to image for table extraction");
        return null;
      }
      
      console.log(`Successfully extracted image for page ${creditAccountsPage}`);
      
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

/**
 * Extract the collections table image from the PDF
 * This uses image-based extraction specifically for collections
 */
export const extractCollectionsTableImage = async (report: any): Promise<string | null> => {
  try {
    console.log("Attempting to extract collections table image");
    
    // If we already have a collections table image URL cached, return it
    if (currentPdfData.collectionTableImageUrl) {
      console.log("Using cached collections table image URL");
      return currentPdfData.collectionTableImageUrl;
    }
    
    // If no PDF document is available, we can't extract an image
    if (!currentPdfData.pdfDocument) {
      console.error("No PDF document available for collections image extraction");
      return null;
    }
    
    const pdfDocument = currentPdfData.pdfDocument;
    const numPages = pdfDocument.numPages;
    
    // Keywords to identify the collections section
    const collectionsKeywords = [
      'collections',
      'collection agency',
      'original creditor',
      'amount owed',
      'date reported',
      'date assigned',
      'date of first delinquency',
      'balance date',
      'status date',
      'unpaid'
    ];
    
    // First, try to find which page contains "Collections" header specifically
    let collectionsPage = -1;
    let highestScore = 0;
    
    // Check each page for "Collections" header
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
        
        // Explicitly check for "Collections" header
        if (pageText.includes("collections")) {
          console.log(`Found "Collections" header on page ${i}`);
          
          // Count occurrences of other collection keywords to confirm it's the right section
          let score = 100; // Give high base score for "Collections" heading
          
          collectionsKeywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            const matches = pageText.match(regex);
            if (matches) {
              score += matches.length * 10;
            }
          });
          
          // Check for specific collection patterns
          if (/(collection agency|original creditor).*?(amount|date)/i.test(pageText)) {
            score += 50; // Very strong indicator of collections section
          }
          
          // Look for specific collection-related terms
          if (/status.*?(unpaid|paid|settled|disputed)/i.test(pageText)) {
            score += 40; // Likely collection status information
          }
          
          console.log(`Page ${i} score for collections section: ${score}`);
          
          // If this page has the highest score, use it
          if (score > highestScore) {
            highestScore = score;
            collectionsPage = i;
          }
        }
      } catch (error) {
        console.error(`Error analyzing page ${i} for collections:`, error);
      }
    }
    
    // If we didn't find a page with "Collections" header, fall back to keyword scoring
    if (collectionsPage === -1) {
      console.log("No page with explicit 'Collections' header found, falling back to keyword analysis");
      
      // Process each page to find the one with collection information
      for (let i = 1; i <= numPages; i++) {
        try {
          // Get the page text content
          const page = await pdfDocument.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
          
          // Count occurrences of collection keywords
          let score = 0;
          collectionsKeywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            const matches = pageText.match(regex);
            if (matches) {
              score += matches.length * 5;
            }
          });
          
          // Extra score for specific patterns in collections
          if (/(collection agency|original creditor).*?(date|amount)/i.test(pageText)) {
            score += 30; // Good indicator of collection content
          }
          
          // Look for dates and money amounts (common in collections)
          if (/\$\d+.*?(date|unpaid|assigned)/i.test(pageText)) {
            score += 25; // Likely collection amounts
          }
          
          console.log(`Page ${i} score for collections detection: ${score}`);
          
          // Update best page if this one has a higher score
          if (score > highestScore) {
            highestScore = score;
            collectionsPage = i;
          }
        } catch (error) {
          console.error(`Error processing page ${i} for collections detection:`, error);
        }
      }
    }
    
    console.log(`Best page for collections: ${collectionsPage} with score ${highestScore}`);
    
    // If no good page was found, return null
    if (collectionsPage === -1 || highestScore < 10) {
      console.log("No good page found for collections extraction");
      return null;
    }
    
    // Extract the image of the best page
    try {
      const pageImage = await convertPDFPageToImage(pdfDocument, collectionsPage);
      
      if (!pageImage) {
        console.error("Failed to convert page to image for collections extraction");
        return null;
      }
      
      console.log(`Successfully extracted image for collections page ${collectionsPage}`);
      
      // Store the image URL in the current PDF data
      currentPdfData.collectionTableImageUrl = pageImage;
      
      return pageImage;
    } catch (error) {
      console.error("Error extracting collections image:", error);
      return null;
    }
  } catch (error) {
    console.error("Error extracting collections table image:", error);
    return null;
  }
};
