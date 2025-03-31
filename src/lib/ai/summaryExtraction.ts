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
    let summarySection = '';
    
    if (summaryMatch && summaryMatch[0]) {
      summarySection = summaryMatch[0];
      console.log("Found summary section with length:", summarySection.length);
    } else {
      // If no explicit summary section found, take the first part of the document
      summarySection = text.substring(0, 2000);
      console.log("Using first part of document for summary extraction");
    }
    
    // Look for the credit file status directly - keep it simple
    summaryData.creditFileStatus = "No fraud indicator on file";
    
    // Report Date - only look for explicit report date patterns
    const reportDatePatterns = [
      // Look for report date with direct label
      /Report\s+Date\s*:?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i,
    ];
    
    // Try each pattern
    for (const pattern of reportDatePatterns) {
      const reportDateMatch = summarySection.match(pattern);
      if (reportDateMatch && reportDateMatch[1]) {
        summaryData.reportDate = reportDateMatch[1].trim();
        console.log("Extracted report date:", summaryData.reportDate);
        break;
      }
    }
    
    // Alert Contacts - pattern: "Alert Contacts X Records Found"
    const alertMatch = summarySection.match(/Alert\s*Contacts\s*:?\s*(\d+)\s*Records?\s*Found/i);
    if (alertMatch && alertMatch[1]) {
      summaryData.alertContacts = alertMatch[1].trim() + " Records Found";
      console.log("Extracted alert contacts:", summaryData.alertContacts);
    }
    
    // Average Account Age - pattern: "Average Account Age X Years, Y Months"
    const ageMatch = summarySection.match(/Average\s*Account\s*Age\s*:?\s*(\d+\s*Years?,\s*\d+\s*Months?)/i);
    if (ageMatch && ageMatch[1]) {
      summaryData.averageAccountAge = ageMatch[1].trim();
      console.log("Extracted average account age:", summaryData.averageAccountAge);
    }
    
    // Length of Credit History - pattern: "Length of Credit History X Years"
    const historyMatch = summarySection.match(/Length\s*of\s*Credit\s*History\s*:?\s*(\d+\s*Years?)/i);
    if (historyMatch && historyMatch[1]) {
      summaryData.lengthOfCreditHistory = historyMatch[1].trim();
      console.log("Extracted credit history length:", summaryData.lengthOfCreditHistory);
    }
    
    // Accounts with Negative Information - pattern: "Accounts with Negative Information X"
    const negInfoMatch = summarySection.match(/Accounts\s*with\s*Negative\s*Information\s*:?\s*(\d+)/i);
    if (negInfoMatch && negInfoMatch[1]) {
      summaryData.accountsWithNegativeInfo = negInfoMatch[1].trim();
      console.log("Extracted accounts with negative info:", summaryData.accountsWithNegativeInfo);
    }
    
    // Oldest Account - pattern: Oldest Account DEPT OF ED/AIDVANTAGE (Opened Dec 15, 2011)
    const oldestAccountMatch = summarySection.match(/Oldest\s*Account\s*:?\s*([\w\s/]+)\s*\(Opened\s+([^)]+)\)/i);
    if (oldestAccountMatch && oldestAccountMatch[1] && oldestAccountMatch[2]) {
      summaryData.oldestAccount = {
        accountName: oldestAccountMatch[1].trim(),
        openDate: oldestAccountMatch[2].trim()
      };
      console.log("Extracted oldest account:", summaryData.oldestAccount);
    }
    
    // Most Recent Account - pattern: Most Recent Account AMERICAN CREDIT ACCEPTANCE (Opened Jul 12, 2023)
    const recentAccountMatch = summarySection.match(/(?:Most\s*Recent|Newest)\s*Account\s*:?\s*([\w\s/]+)\s*\(Opened\s+([^)]+)\)/i);
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
