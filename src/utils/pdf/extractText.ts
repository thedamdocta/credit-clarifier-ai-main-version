
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
    
    // Check if we're looking for collections specifically
    if (report.collections || currentPdfData.targetTable === 'Collections') {
      console.log("Looking for collections table instead of credit accounts");
      tableKeywords.length = 0; // Clear the array
      
      // Add collection-specific keywords
      tableKeywords.push(
        'collections',
        'collection account',
        'collection agencies',
        'original creditor',
        'amount placed',
        'amount owed',
        'date opened',
        'date reported',
        'status date',
        'collection agency'
      );
    }
    
    // First, try to find which page contains "Credit Accounts" header specifically
    let creditAccountsPage = -1;
    let highestScore = 0;
    
    // Check each page for "Credit Accounts" header or "Collections" header
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
        
        // Set the search term based on what we're looking for
        const searchTerm = report.collections || currentPdfData.targetTable === 'Collections' 
          ? "collection" 
          : "credit accounts";
        
        // Explicitly check for the appropriate header
        if (pageText.includes(searchTerm)) {
          console.log(`Found "${searchTerm}" term on page ${i}`);
          
          // Count occurrences of other table keywords to confirm it's the right table
          let score = 100; // Give high base score for heading match
          
          tableKeywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            const matches = pageText.match(regex);
            if (matches) {
              score += matches.length;
            }
          });
          
          // For collections specifically, check for collection patterns
          if (report.collections || currentPdfData.targetTable === 'Collections') {
            // Look for patterns that indicate a collection entry
            if (/collection.*?agency|original.*?creditor|date.*?assigned/i.test(pageText)) {
              score += 50;
            }
            
            // Look for dates which are common in collection entries
            if (/\d{2}\/\d{2}\/\d{4}.*collection/i.test(pageText)) {
              score += 30;
            }
          } else {
            // Check for specific patterns that indicate an account summary table
            if (/(revolving|mortgage|installment).*?\d+.*?(balance|open)/i.test(pageText)) {
              score += 50; // Very strong indicator of the right table
            }
            
            // Look for column headers typical in account summary tables
            if (/account\s+type.*open.*with\s+balance.*total\s+balance/i.test(pageText)) {
              score += 75; // Almost definitely the right table
            }
          }
          
          console.log(`Page ${i} score: ${score}`);
          
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
    
    // If we didn't find a page with the specific header, fall back to keyword scoring
    if (creditAccountsPage === -1) {
      console.log("No page with explicit header found, falling back to keyword analysis");
      
      // Process each page to find the one with the table
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
          
          // Extra score for specific patterns
          if (report.collections || currentPdfData.targetTable === 'Collections') {
            // Patterns specific to collection accounts
            if (/collection.*?agency|original.*?creditor|date.*?assigned/i.test(pageText)) {
              score += 40;
            }
            
            // Look for dates which are common in collection entries
            if (/\d{2}\/\d{2}\/\d{4}.*collection/i.test(pageText)) {
              score += 25;
            }
            
            // Look for dollar amounts with collection references
            if (/\$\d+,?\d*.*?collection|collection.*?\$\d+,?\d*/i.test(pageText)) {
              score += 30;
            }
          } else {
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
          }
          
          console.log(`Page ${i} score for table detection: ${score}`);
          
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
    
    console.log(`Best page for table: ${creditAccountsPage} with score ${highestScore}`);
    
    // If no good page was found, return null
    if (creditAccountsPage === -1 || highestScore < 10) {
      console.log("No good page found for table extraction");
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
 * Extract collections data from the PDF document text
 * This function parses the text to find collection accounts
 */
export const extractCollectionsFromText = (text: string): Array<any> => {
  if (!text) return [];
  
  console.log("Attempting to extract collections data from text");
  
  // Normalize text for easier processing
  const normalizedText = text.replace(/\s+/g, ' ').toLowerCase();
  
  // Collections section identifiers
  const collectionSectionMarkers = [
    'collection accounts',
    'accounts in collection',
    'collection agency accounts',
    'items reported in collection'
  ];
  
  // Find the collections section
  let collectionsSection = '';
  let collectionsFound = false;
  
  for (const marker of collectionSectionMarkers) {
    const markerIndex = normalizedText.indexOf(marker);
    if (markerIndex !== -1) {
      collectionsFound = true;
      
      // Extract the section after the marker
      // Look for the next major section heading to end the collections section
      const possibleEndMarkers = [
        'credit accounts',
        'inquiries',
        'public records',
        'credit score',
        'consumer statements'
      ];
      
      let endIndex = normalizedText.length;
      for (const endMarker of possibleEndMarkers) {
        const endMarkerIndex = normalizedText.indexOf(endMarker, markerIndex + marker.length);
        if (endMarkerIndex !== -1 && endMarkerIndex < endIndex) {
          endIndex = endMarkerIndex;
        }
      }
      
      collectionsSection = normalizedText.substring(markerIndex, endIndex);
      break;
    }
  }
  
  if (!collectionsFound || !collectionsSection) {
    console.log("No collections section found");
    return [];
  }
  
  console.log("Collections section found, length:", collectionsSection.length);
  
  // Extract individual collection accounts
  const collections = [];
  
  // Look for collection agency names (usually followed by contact info or account details)
  const agencyPattern = /(?:collection agency|placed with)[:\s]*([\w\s&]+)(?:\s|$)/gi;
  let match;
  
  while ((match = agencyPattern.exec(collectionsSection)) !== null) {
    const agencyName = match[1].trim();
    
    // Search for associated data near this agency mention
    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(collectionsSection.length, match.index + 500);
    const context = collectionsSection.substring(contextStart, contextEnd);
    
    // Extract possible amount
    const amountMatch = /(?:\$|amount)[:\s]*([0-9,.]+)/i.exec(context);
    const amount = amountMatch ? `$${amountMatch[1]}` : null;
    
    // Extract possible original creditor
    const creditorMatch = /(?:original creditor|creditor)[:\s]*([\w\s&.,]+)(?:\s|$)/i.exec(context);
    const originalCreditor = creditorMatch ? creditorMatch[1].trim() : null;
    
    // Extract possible date
    const dateMatch = /(?:date opened|date reported|date assigned)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i.exec(context);
    const dateReported = dateMatch ? dateMatch[1] : null;
    
    // Extract possible account number (may be partially masked)
    const accountMatch = /(?:account (?:number|#)|acct[:\s]*)[:\s]*([\d\w\*]+)/i.exec(context);
    const accountNumber = accountMatch ? accountMatch[1].trim() : null;
    
    // Extract status if available
    const statusMatch = /(?:status)[:\s]*([a-z\s]+)(?:\s|$)/i.exec(context);
    const status = statusMatch ? statusMatch[1].trim() : null;
    
    collections.push({
      collectionAgency: agencyName,
      amount: amount,
      originalCreditorName: originalCreditor,
      dateReported: dateReported,
      accountNumber: accountNumber,
      status: status,
      balanceDate: null,
      accountDesignatorCode: null,
      dateAssigned: null,
      originalAmountOwed: null,
      creditorClassification: null,
      lastPaymentDate: null,
      statusDate: null,
      dateOfFirstDelinquency: null,
      comments: [],
      contact: []
    });
  }
  
  console.log(`Extracted ${collections.length} collection accounts`);
  return collections;
};
