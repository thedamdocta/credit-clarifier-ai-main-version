
import { extractEntities } from './textAnalysis';
import { CreditReport } from '../types/creditReport';

/**
 * Specialized NLP-based extraction for credit report summary sections
 * This targets specific fields with focused extraction rather than parsing the entire document
 */
export const extractReportSummaryWithAI = async (text: string): Promise<Partial<CreditReport>> => {
  console.log("Extracting report summary fields with AI...");
  
  try {
    // Initialize the return object
    const summaryData: Partial<CreditReport> = {};
    
    // Extract the summary section only - find a section that starts with "Summary" and ends before the next major section
    const summaryMatch = text.match(/(?:1\.|)(?:\s*)Summary\s*(?:\n[\s\S]*?)(?=(?:\d+\.\s*\w+|\n\n\s*\w+\s*\n\n))/i);
    if (!summaryMatch || !summaryMatch[0]) {
      console.log("No summary section found");
      return summaryData;
    }
    
    const summarySection = summaryMatch[0];
    console.log("Found summary section with length:", summarySection.length);
    
    // Extract each field from the summary section with targeted patterns
    
    // Report Date - look for a date format following "Report Date" label
    const reportDateMatch = summarySection.match(/Report\s*Date[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (reportDateMatch && reportDateMatch[1]) {
      summaryData.reportDate = reportDateMatch[1].trim();
      console.log("Extracted report date:", summaryData.reportDate);
    }
    
    // Credit File Status - look for status following the label
    const fileStatusMatch = summarySection.match(/Credit\s*File\s*Status[:\s]*([^\n\r]+)/i);
    if (fileStatusMatch && fileStatusMatch[1]) {
      summaryData.creditFileStatus = fileStatusMatch[1].trim();
      console.log("Extracted credit file status:", summaryData.creditFileStatus);
    }
    
    // Alert Contacts - typically a number followed by "Records Found"
    const alertMatch = summarySection.match(/Alert\s*Contacts[:\s]*(\d+)\s*Records\s*Found/i);
    if (alertMatch && alertMatch[1]) {
      summaryData.alertContacts = alertMatch[1].trim() + " Records Found";
      console.log("Extracted alert contacts:", summaryData.alertContacts);
    } else {
      // Alternative pattern without "Records Found"
      const altAlertMatch = summarySection.match(/Alert\s*Contacts[:\s]*([^\n\r]+)/i);
      if (altAlertMatch && altAlertMatch[1]) {
        summaryData.alertContacts = altAlertMatch[1].trim();
      }
    }
    
    // Average Account Age
    const ageMatch = summarySection.match(/Average\s*Account\s*Age[:\s]*([^\n\r]+)/i);
    if (ageMatch && ageMatch[1]) {
      summaryData.averageAccountAge = ageMatch[1].trim();
      console.log("Extracted average account age:", summaryData.averageAccountAge);
    }
    
    // Length of Credit History
    const historyMatch = summarySection.match(/Length\s*of\s*Credit\s*History[:\s]*([^\n\r]+)/i);
    if (historyMatch && historyMatch[1]) {
      summaryData.lengthOfCreditHistory = historyMatch[1].trim();
      console.log("Extracted credit history length:", summaryData.lengthOfCreditHistory);
    }
    
    // Accounts with Negative Information
    const negInfoMatch = summarySection.match(/Accounts\s*with\s*Negative\s*Information[:\s]*(\d+)/i);
    if (negInfoMatch && negInfoMatch[1]) {
      summaryData.accountsWithNegativeInfo = negInfoMatch[1].trim();
      console.log("Extracted accounts with negative info:", summaryData.accountsWithNegativeInfo);
    }
    
    // Oldest Account - pattern: Oldest Account: NAME (Opened DATE)
    const oldestAccountMatch = summarySection.match(/Oldest\s*Account[:\s]*([^(]+)\s*\(Opened\s+([^)]+)\)/i);
    if (oldestAccountMatch && oldestAccountMatch[1] && oldestAccountMatch[2]) {
      summaryData.oldestAccount = {
        accountName: oldestAccountMatch[1].trim(),
        openDate: oldestAccountMatch[2].trim()
      };
      console.log("Extracted oldest account:", summaryData.oldestAccount);
    }
    
    // Most Recent Account - pattern: Most Recent Account: NAME (Opened DATE)
    const recentAccountMatch = summarySection.match(/(?:Most\s*Recent|Newest)\s*Account[:\s]*([^(]+)\s*\(Opened\s+([^)]+)\)/i);
    if (recentAccountMatch && recentAccountMatch[1] && recentAccountMatch[2]) {
      summaryData.recentAccount = {
        accountName: recentAccountMatch[1].trim(),
        openDate: recentAccountMatch[2].trim()
      };
      console.log("Extracted most recent account:", summaryData.recentAccount);
    }
    
    return summaryData;
  } catch (error) {
    console.error("Error extracting summary with AI:", error);
    return {};
  }
};

/**
 * AI-enhanced extraction of summary fields from an Equifax report
 */
export const enhanceEquifaxSummaryWithAI = async (text: string, existingSummary: Partial<CreditReport>): Promise<Partial<CreditReport>> => {
  // First try targeted extraction
  const aiExtractedSummary = await extractReportSummaryWithAI(text);
  
  // Merge with existing summary data, preferring AI extracted data where available
  return {
    ...existingSummary,
    ...aiExtractedSummary
  };
};
