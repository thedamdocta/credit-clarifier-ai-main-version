
import { parsingLogger } from "@/utils/parsingLogger";

let extractedReportData: any = null;
let currentReportImage: string | null = null;
let currentPDFData: {
  file?: File,
  reportId?: string
} = {};

// Function to extract text from PDF pages
export async function extractTextFromPDF(pdf: any, options = { sampleLimit: 1000 }): Promise<string> {
  try {
    const numPages = pdf.numPages;
    let fullText = '';
    
    // Process each page
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract text from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
      
      // If we have enough sample text, stop processing
      if (fullText.length > options.sampleLimit && options.sampleLimit > 0) {
        console.log(`Reached sample limit of ${options.sampleLimit} characters`);
        break;
      }
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return '';
  }
}

// Function to set current PDF data and return a unique report ID
export function setCurrentPDFData(file: File): string {
  const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  currentPDFData = {
    file,
    reportId
  };
  return reportId;
}

// Function to extract credit account table image specifically
export async function extractCreditAccountsTableImage(report: any): Promise<string | null> {
  try {
    // If we already have a current image for this report, use it
    if (currentReportImage) {
      console.log("Using cached table image");
      // Log it for debugging
      parsingLogger.logEvent('table_image_extracted', { 
        imageUrlLength: currentReportImage.length,
        fromCache: true
      });
      return currentReportImage;
    }

    // Check if we have a PDF document to extract from
    if (!report || !report.pdfDocument) {
      console.log("No PDF document available for table extraction");
      return null;
    }
    
    const pdf = report.pdfDocument;
    
    // Determine which page to extract from (usually page 1 or 2)
    let targetPage = 1;
    
    // If we have raw text, try to determine which page has the account summary table
    if (report.rawText) {
      const pageTexts = report.rawPageTexts || [];
      
      // Look for account summary table indicators on each page
      for (let i = 0; i < pageTexts.length; i++) {
        const pageText = pageTexts[i];
        if (pageText && 
            (pageText.includes("Account Type") || 
             pageText.includes("Revolving") || 
             pageText.includes("Installment"))) {
          targetPage = i + 1;
          console.log(`Found account table indicators on page ${targetPage}`);
          break;
        }
      }
    }
    
    // Convert the target page to an image
    const { convertPDFPageToImage } = await import('./pdfToImage');
    const pageImage = await convertPDFPageToImage(pdf, targetPage);
    
    if (!pageImage) {
      console.log("Failed to convert PDF page to image");
      return null;
    }
    
    // For now, we'll use the full page image
    // In a more advanced implementation, we could detect and crop just the table region
    const tableImage = pageImage;
    
    // When image is found, store it for reuse
    if (tableImage) {
      currentReportImage = tableImage;
      // Log it for debugging
      parsingLogger.logEvent('table_image_extracted', { 
        imageUrlLength: tableImage.length,
        fromCache: false
      });
    }
    
    return tableImage;
  } catch (error) {
    console.error("Error extracting credit accounts table image:", error);
    return null;
  }
}

// Function to get the extracted report data
export function getExtractedReportData(): any {
  return extractedReportData;
}

// Function to save extracted report data
export function saveExtractedReportData(data: any): void {
  extractedReportData = data;
}

// Function to set extracted report data
export function setExtractedReportData(data: any): void {
  extractedReportData = data;
}

// Function to reset the current report image
export function resetCurrentReportImage(): void {
  currentReportImage = null;
}
