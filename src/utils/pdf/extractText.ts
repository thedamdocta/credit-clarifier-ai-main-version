
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

// Global storage for tracking the current PDF file
let currentPDFData: {
  timestamp: number;
  uploadedFile: File | null;
  reportId: string | null;
  extractedData: any | null; // Store extracted data to prevent overwriting with sample data
} = {
  timestamp: 0,
  uploadedFile: null,
  reportId: null,
  extractedData: null
};

// Store the most recent uploaded file data
export const setCurrentPDFData = (file: File) => {
  console.log('Setting current PDF file:', file.name);
  
  // Generate a truly unique ID that includes file name and timestamp
  const uniqueId = `report-${Date.now()}-${file.name.replace(/\W/g, '')}`;
  
  currentPDFData = {
    timestamp: Date.now(),
    uploadedFile: file,
    reportId: uniqueId,
    extractedData: null // Reset extracted data for new file
  };
  
  console.log('Updated current PDF data with new reportId:', uniqueId);
  return currentPDFData.reportId;
};

// Set extracted data when it's actually obtained from a real file
export const setExtractedReportData = (data: any) => {
  if (data && currentPDFData) {
    console.log('Storing actual extracted data for report:', currentPDFData.reportId);
    currentPDFData.extractedData = data;
    return true;
  }
  return false;
};

// Get extracted data if we have it
export const getExtractedReportData = () => {
  return currentPDFData?.extractedData || null;
};

// Reset current data (for cleanup)
export const resetCurrentReportImage = () => {
  console.log('Resetting current report data');
  if (currentPDFData) {
    currentPDFData.timestamp = Date.now(); // Update timestamp to indicate a fresh reset
  }
};

// This function now just returns null since we're not using images anymore
export const extractCreditAccountsTableImage = async (report: CreditReport | null): Promise<string | null> => {
  console.log('No image extraction needed - using text-based extraction');
  return null;
};
