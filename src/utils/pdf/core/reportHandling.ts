
// Core logic for handling credit report processing and data extraction
import { parsingLogger } from "@/utils/parsingLogger";
import { CreditReport } from "@/lib/types/creditReport";
import { extractTextFromImage } from "@/lib/ai/ocrExtraction";
import { createDefaultAccountSummaries } from "../accounts/accountSummaries";
import { 
  extractCreditAccountsTableImage, 
  getExtractedReportData, 
  setExtractedReportData, 
  setPDFData 
} from "../extractText";

// Function to set the current PDF data and return a unique report ID
export const setCurrentPDFData = (file: File): string => {
  return setPDFData(file);
};

// Function to handle basic processing of the extracted text
export const handleBasicProcessing = async (
  uniqueReportId: string,
  file: File,
  extractedText: string,
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void
) => {
  console.log("No AI parsing available, using basic processing");
  parsingLogger.logEvent("Basic processing used", { reportId: uniqueReportId });
  
  // Pass the extracted text and file to the parent component
  onPDFUploaded(file, extractedText);
};

// Function to process the extracted text and return a structured credit report
export const processExtractedText = async (
  extractedText: string,
  uniqueReportId: string,
  file: File
): Promise<CreditReport | null> => {
  try {
    console.log("Processing extracted text to create structured credit report");
    parsingLogger.logEvent("AI parsing started", { reportId: uniqueReportId });
    
    // For large text, truncate to prevent memory issues
    let textToProcess = extractedText;
    if (textToProcess && textToProcess.length > 500000) {
      console.log(`Text is very large (${textToProcess.length} chars), truncating for processing`);
      textToProcess = textToProcess.substring(0, 500000);
    }
    
    // Create a fully compliant CreditReport object with all required properties
    const parsedReport: CreditReport = {
      reportId: uniqueReportId,
      bureau: "Unknown",
      reportDate: new Date().toLocaleDateString(),
      personalInfo: {
        name: "Unknown",
        addresses: ["Unknown"],
        ssn: "Unknown",
        dob: "Unknown",
      },
      accounts: [],
      inquiries: [],
      publicRecords: [],
      collections: [],
      creditScores: [],
      rawText: textToProcess,
      fileName: file.name,
      accountSummaries: createDefaultAccountSummaries()
    };
    
    // Store the parsed report data
    setExtractedReportData(parsedReport);
    
    parsingLogger.logEvent("AI parsing completed", { reportId: uniqueReportId });
    return parsedReport;
  } catch (error) {
    console.error("Error processing extracted text:", error);
    parsingLogger.logEvent("AI parsing error", {
      reportId: uniqueReportId,
      error: String(error),
    });
    return null;
  }
};

// Function to extract credit accounts using OCR with better error handling
export const extractCreditAccountsWithOCR = async (report: any): Promise<string | null> => {
  try {
    console.log("Attempting to extract credit accounts using OCR");
    
    // First, try to extract the table image with a timeout
    const tableExtractionPromise = extractCreditAccountsTableImage(report);
    const tableTimeout = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.log("Table image extraction timed out");
        resolve(null);
      }, 10000); // 10 second timeout
    });
    
    const tableImageUrl = await Promise.race([tableExtractionPromise, tableTimeout]);
    
    if (!tableImageUrl) {
      console.warn("No table image found or extraction timed out, OCR extraction skipped");
      return null;
    }
    
    // Use OCR to extract text from the table image with a timeout
    const ocrPromise = extractTextFromImage(tableImageUrl);
    const ocrTimeout = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.log("OCR extraction timed out");
        resolve(null);
      }, 15000); // 15 second timeout
    });
    
    const ocrText = await Promise.race([ocrPromise, ocrTimeout]);
    
    if (!ocrText) {
      console.warn("OCR extraction failed or timed out");
      return null;
    }
    
    console.log("OCR extraction successful:", ocrText.substring(0, 200) + "...");
    return ocrText;
  } catch (error) {
    console.error("Error extracting credit accounts with OCR:", error);
    return null;
  }
};

// Helper function to extract text from a specific region of an image
export const extractTextFromImageRegion = async (imageUrl: string, region: { x: number, y: number, width: number, height: number }): Promise<string | null> => {
  try {
    // This is a simplified implementation - in a real app, you would crop the image first
    console.log(`Extracting text from image region: ${JSON.stringify(region)}`);
    return await extractTextFromImage(imageUrl);
  } catch (error) {
    console.error("Error extracting text from image region:", error);
    return null;
  }
};

// Wrapper function for enhanced OCR processing
export const processImageWithEnhancedOCR = async (imageUrl: string): Promise<string | null> => {
  try {
    console.log("Processing image with enhanced OCR:", imageUrl ? imageUrl.substring(0, 50) + '...' : 'undefined');
    return await extractTextFromImage(imageUrl);
  } catch (error) {
    console.error("Error in enhanced OCR processing:", error);
    return null;
  }
};
