
// Functions for handling the basic report data
import { toast } from "sonner";
import { extractTextFromPDF, setExtractedReportData } from "../extractText";
import { CreditReport } from "@/lib/types/creditReport";

// Extract basic processing into a separate function for better readability
export async function handleBasicProcessing(
  reportId: string, 
  file: File, 
  extractedText: string, 
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void
) {
  // Add small delay to prevent UI freezing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const basicReport: CreditReport = { 
    reportId: reportId,
    fileName: file.name,
    rawText: extractedText,
    bureau: 'Unknown' as const,
    reportDate: new Date().toISOString().split('T')[0],
    personalInfo: { name: 'Unknown', addresses: [] },
    accounts: [],
    inquiries: [],
    publicRecords: [],
    collections: [],
    creditScores: []
  };
  
  // Store in global for easier access
  if (window) {
    window.currentPdfData = {
      reportId: reportId,
      fileName: file.name,
      extractedText: extractedText.substring(0, 1000)
    };
  }
  
  // Store this parsed data in our cache
  setExtractedReportData(basicReport);
  
  onPDFUploaded(file, extractedText, basicReport);
  toast.success("PDF processed with basic extraction");
}

// Function to store PDF data in global and generate a unique report ID
export function setCurrentPDFData(file: File): string {
  const uniqueReportId = `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  // Store this file as the current PDF being processed with a unique ID
  console.log(`Set unique report ID: ${uniqueReportId}`);
  
  return uniqueReportId;
}
