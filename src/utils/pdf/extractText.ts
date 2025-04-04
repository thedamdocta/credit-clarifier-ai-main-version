
// Import from the correct pdfjs-dist types path
import { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import { CreditReport } from "@/lib/types/creditReport";

// Store the extracted report data
let extractedReportData: CreditReport | null = null;

// Get the extracted report data
export const getExtractedReportData = () => {
  return extractedReportData;
};

// Set the extracted report data
export const setExtractedReportData = (report: CreditReport) => {
  extractedReportData = report;
};

// Reset the extracted report data
export const resetExtractedReportData = () => {
  extractedReportData = null;
};

// Store the current report image URL
let currentReportImageURL: string | null = null;

export const resetCurrentReportImage = () => {
  currentReportImageURL = null;
};

export const setCurrentReportImage = (url: string) => {
  currentReportImageURL = url;
};

export const getCurrentReportImage = () => {
  return currentReportImageURL;
};

// Extract text from PDF document
export const extractTextFromPDF = async (pdf: PDFDocumentProxy): Promise<string> => {
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => {
        // TypeScript check for the TextItem type which has the 'str' property
        if ('str' in item) {
          return (item as TextItem).str;
        }
        return ''; // Return empty string for TextMarkedContent
      })
      .join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
};

// Store the current PDF data
let currentPDFData: {
  file: File | null;
  pdfDocument: any;
  targetTable?: string;
  reportId: string;
} | null = null;

// Get the current PDF data
export const getCurrentPDFData = () => {
  return currentPDFData;
};

// Set the current PDF data
export const setCurrentPDFData = (file: File, options: { targetTable?: string } = {}) => {
  const reportId = `report_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  currentPDFData = {
    file,
    pdfDocument: null,
    targetTable: options.targetTable,
    reportId
  };
  
  return reportId;
};

// Parse PDF content
export const parsePDFContent = async (text: string, useAI: boolean): Promise<CreditReport | null> => {
  try {
    if (text.includes("EQUIFAX")) {
      // Correctly import the function from our creditReportParser
      const { parseEquifaxReport } = await import("@/lib/parsers/equifax/equifaxParser");
      const report = await parseEquifaxReport(text);
      // Ensure we're returning a complete CreditReport object with all required fields
      return report as CreditReport;
    } else if (text.includes("Experian")) {
      // Placeholder for Experian parsing
      console.log("Experian report detected, but parsing is not yet implemented.");
      return null;
    } else if (text.includes("TransUnion")) {
      // Placeholder for TransUnion parsing
      console.log("TransUnion report detected, but parsing is not yet implemented.");
      return null;
    } else {
      console.log("Unknown credit report format.");
      return null;
    }
  } catch (error) {
    console.error("Error parsing PDF content:", error);
    return null;
  }
};

// Extract credit accounts table image from a report
export const extractCreditAccountsTableImage = async (report: CreditReport): Promise<string | null> => {
  try {
    // Return cached image if available
    if (currentReportImageURL) {
      console.log("Using cached credit accounts table image");
      return currentReportImageURL;
    }
    
    console.log("Attempting to extract credit accounts table image from PDF");
    
    // Get PDF data from current session
    const pdfData = getCurrentPDFData();
    if (!pdfData || !pdfData.pdfDocument) {
      console.error("No PDF document available for credit accounts table extraction");
      return null;
    }
    
    // Keywords to identify accounts section in the report
    const accountKeywords = [
      "account summary",
      "account type",
      "revolving accounts",
      "credit accounts",
      "mortgage accounts",
      "installment accounts",
      "summary of your accounts",
      "accounts summary"
    ];
    
    // Search text for accounts section
    const rawText = report.rawText || "";
    let accountsPageNumber = -1;
    
    // Try to find the accounts section using keywords
    for (const keyword of accountKeywords) {
      const keywordIndex = rawText.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordIndex !== -1) {
        // Estimate which page this content is on
        const approximateCharsPerPage = 3500; // Adjust based on your reports
        accountsPageNumber = Math.floor(keywordIndex / approximateCharsPerPage) + 1;
        console.log(`Found accounts keyword "${keyword}" around page ${accountsPageNumber}`);
        break;
      }
    }
    
    if (accountsPageNumber === -1) {
      // If the account section page wasn't found, look for typical tables
      const tablePatterns = [
        /\bAcct\s+Type\b.*\bOpen\b.*\bWith Balance\b/i,
        /\bRevolving\b.*\bInstallment\b.*\bMortgage\b/i,
        /\bTotal Accounts\b.*\bTotal Balance\b/i
      ];
      
      for (const pattern of tablePatterns) {
        const match = rawText.match(pattern);
        if (match) {
          const textBeforeMatch = rawText.substring(0, match.index || 0);
          const approximateLineNumber = textBeforeMatch.split("\n").length;
          accountsPageNumber = Math.floor(approximateLineNumber / 40) + 1; // Assuming ~40 lines per page
          console.log(`Found accounts table pattern around page ${accountsPageNumber}`);
          break;
        }
      }
    }
    
    // If still not found, try page estimation based on document structure
    if (accountsPageNumber === -1) {
      const totalPages = pdfData.pdfDocument.numPages;
      // Account summary usually appears in the first third of the report
      accountsPageNumber = Math.floor(totalPages / 3);
      console.log(`No accounts keyword found, trying estimated page ${accountsPageNumber}`);
    }
    
    // Ensure page number is valid
    const numPages = pdfData.pdfDocument.numPages;
    if (accountsPageNumber < 1) accountsPageNumber = 1;
    if (accountsPageNumber > numPages) accountsPageNumber = numPages;
    
    // Import the conversion function from pdfToImage
    const { convertPDFPageToImage } = await import("./pdfToImage");
    
    // Try the identified page first
    console.log(`Attempting to extract from page ${accountsPageNumber}`);
    let imageUrl = await convertPDFPageToImage(pdfData.pdfDocument, accountsPageNumber);
    
    // If we can't find the image on the identified page, try adjacent pages
    if (!imageUrl) {
      const pagesToCheck = [];
      // Add 2 pages before and after the estimated page
      for (let i = 1; i <= 2; i++) {
        if (accountsPageNumber + i <= numPages) {
          pagesToCheck.push(accountsPageNumber + i);
        }
        if (accountsPageNumber - i >= 1) {
          pagesToCheck.push(accountsPageNumber - i);
        }
      }
      
      // Try each page until we find an image
      for (const pageNum of pagesToCheck) {
        console.log(`Trying accounts page ${pageNum}`);
        imageUrl = await convertPDFPageToImage(pdfData.pdfDocument, pageNum);
        if (imageUrl) {
          console.log(`Found accounts image on page ${pageNum}`);
          break;
        }
      }
    }
    
    if (imageUrl) {
      console.log("Successfully extracted credit accounts table image");
      currentReportImageURL = imageUrl;
      return imageUrl;
    } else {
      console.error("Failed to extract credit accounts table image");
      return null;
    }
  } catch (error) {
    console.error("Error extracting credit accounts table image:", error);
    return null;
  }
};
