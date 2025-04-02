
import { toast } from "sonner";
import { parseCreditReport } from "@/lib/creditReportParser";
import { resetCurrentReportImage } from "./extractText";
import { identifyDocumentPatterns } from "./patterns/documentPatterns";
import { createDefaultAccountSummaries } from "./accounts/accountSummaries";
import { enhanceEquifaxReport } from "./bureaus/equifaxEnhancer";

/**
 * Main PDF content parsing function
 */
export const parsePDFContent = async (extractedText: string, useAI: boolean = false) => {
  try {
    console.log('Parsing PDF content...');
    resetCurrentReportImage();
    
    if (!extractedText || extractedText.length < 100) {
      console.error('Extracted text is too short for parsing');
      toast.error('The PDF content could not be processed correctly');
      return null;
    }
    
    const patterns = identifyDocumentPatterns(extractedText);
    console.log('Document patterns identified:', patterns);
    
    let parsedReport = await parseCreditReport(extractedText);
    console.log('Basic report parsing complete:', parsedReport?.bureau);
    
    if (!parsedReport) {
      console.error('Failed to parse credit report');
      toast.error('Unable to parse the credit report');
      return null;
    }
    
    // Ensure all required fields are present
    parsedReport.rawText = extractedText;
    
    if (!parsedReport.reportId) {
      parsedReport.reportId = `report-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    
    if (!parsedReport.reportDate) {
      parsedReport.reportDate = new Date().toLocaleDateString();
    }
    
    if (!parsedReport.accounts) {
      parsedReport.accounts = [];
    }
    
    if (!parsedReport.inquiries) {
      parsedReport.inquiries = [];
    }
    
    if (!parsedReport.publicRecords) {
      parsedReport.publicRecords = [];
    }
    
    if (!parsedReport.collections) {
      parsedReport.collections = [];
    }
    
    if (!parsedReport.creditScores) {
      parsedReport.creditScores = [];
    }
    
    if (parsedReport.bureau === 'Equifax') {
      parsedReport = await enhanceEquifaxReport(parsedReport, extractedText);
    }
    
    if (!parsedReport.accountSummaries || parsedReport.accountSummaries.length === 0) {
      console.log('No account summaries found, creating default ones');
      parsedReport.accountSummaries = createDefaultAccountSummaries();
    }
    
    console.log('Enhanced parsing complete!');
    return parsedReport;
  } catch (error) {
    console.error('Error parsing PDF content:', error);
    toast.error('There was an error processing the PDF content');
    
    // Return a minimal valid report to avoid TypeScript errors
    const fallbackReport = {
      bureau: 'Unknown' as const,
      reportDate: new Date().toLocaleDateString(),
      personalInfo: {
        name: 'Not Found',
        addresses: ['Not Found']
      },
      accounts: [],
      inquiries: [],
      publicRecords: [],
      collections: [],
      creditScores: [],
      rawText: extractedText,
      parsingError: String(error)
    };
    
    return fallbackReport;
  }
};

// Re-export all the extracted functions for backward compatibility
export * from "./patterns/documentPatterns";
export * from "./accounts/accountSummaries";
export * from "./bureaus/equifaxEnhancer";
export { parsePDFContent };
