
// Core logic for handling credit report processing and data extraction
import { parsingLogger } from "@/utils/parsingLogger";
import { CreditReport } from "@/lib/types/creditReport";
import { extractTextFromImageRegion, processImageWithEnhancedOCR } from "@/lib/ai/ocrExtraction";
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
      rawText: extractedText,
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

// Function to extract credit accounts using OCR
export const extractCreditAccountsWithOCR = async (report: any): Promise<string | null> => {
  try {
    console.log("Attempting to extract credit accounts using OCR");
    
    // First, try to extract the table image
    let tableImageUrl = await extractCreditAccountsTableImage(report);
    
    if (!tableImageUrl) {
      console.warn("No table image found, OCR extraction skipped");
      return null;
    }
    
    // Use enhanced OCR to extract text from the table image
    const ocrText = await processImageWithEnhancedOCR(tableImageUrl);
    
    if (!ocrText) {
      console.warn("OCR extraction failed");
      return null;
    }
    
    console.log("OCR extraction successful:", ocrText);
    return ocrText;
  } catch (error) {
    console.error("Error extracting credit accounts with OCR:", error);
    return null;
  }
};
