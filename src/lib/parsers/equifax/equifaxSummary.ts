
import { enhanceEquifaxSummaryWithAI } from '../../ai/summaryExtraction';

/**
 * Extracts summary information from Equifax credit report format
 */
export const extractEquifaxSummary = async (text: string): Promise<{
  creditFileStatus?: string;
  alertContacts?: string;
  averageAccountAge?: string;
  lengthOfCreditHistory?: string;
  accountsWithNegativeInfo?: string;
  oldestAccount?: {
    accountName: string;
    openDate: string;
  };
  recentAccount?: {
    accountName: string;
    openDate: string;
  };
}> => {
  console.log("Extracting Equifax summary...");
  
  // Initialize return object
  const summary: any = {};
  
  try {
    // Try AI-enhanced extraction first
    const enhancedSummary = await enhanceEquifaxSummaryWithAI(text, summary);
    
    // If AI extraction was successful, return the enhanced summary
    if (Object.keys(enhancedSummary).length > 0) {
      console.log("AI summary extraction successful");
      return enhancedSummary;
    }
    
    // Fallback to traditional extraction if AI extraction failed
    console.log("Falling back to traditional summary extraction...");
    
    // Look for a "Summary" section - different formats use different headers
    const summaryHeaders = [
      /1\.\s*Summary/i,
      /Credit\s*Summary/i,
      /Report\s*Summary/i,
      /Summary\s*Information/i
    ];
    
    let summarySection = '';
    let summaryMatch = null;
    
    // Try to find a summary section with each header pattern
    for (const header of summaryHeaders) {
      summaryMatch = text.match(new RegExp(`(${header.source}[\\s\\S]*?(?=(?:\\d+\\.\\s*\\w+|Credit Accounts:|Other Items:|$)))`, 'i'));
      if (summaryMatch && summaryMatch[1]) {
        summarySection = summaryMatch[1];
        console.log("Found summary section with header:", header.source);
        break;
      }
    }
    
    if (!summarySection) {
      console.log("No explicit summary section found, using first part of document");
      // Take the first 1000 characters as a fallback
      summarySection = text.substring(0, 1000);
    }
    
    // Extract specific fields with tighter regex patterns
    // Credit File Status
    const fileStatusPattern = /(?:Credit\s+File\s+Status|File\s+Status)[:\s]*([^]*?)(?=Alert\s+Contacts|Average\s+Account|Length\s+of\s+Credit|Accounts\s+with\s+Negative|\n\n|\n\s*\n)/i;
    const fileStatusMatch = summarySection.match(fileStatusPattern);
    if (fileStatusMatch && fileStatusMatch[1]) {
      summary.creditFileStatus = fileStatusMatch[1].trim().replace(/\s+/g, ' ');
    }
    
    // Alert Contacts
    const alertPattern = /Alert\s+Contacts[:\s]*([^]*?)(?=Average\s+Account|Length\s+of\s+Credit|Accounts\s+with\s+Negative|\n\n|\n\s*\n)/i;
    const alertMatch = summarySection.match(alertPattern);
    if (alertMatch && alertMatch[1]) {
      summary.alertContacts = alertMatch[1].trim().replace(/\s+/g, ' ');
    }
    
    // Average Account Age
    const avgAgePattern = /Average\s+Account\s+Age[:\s]*([^]*?)(?=Length\s+of\s+Credit|Accounts\s+with\s+Negative|\n\n|\n\s*\n)/i;
    const avgAgeMatch = summarySection.match(avgAgePattern);
    if (avgAgeMatch && avgAgeMatch[1]) {
      summary.averageAccountAge = avgAgeMatch[1].trim().replace(/\s+/g, ' ');
    }
    
    // Length of Credit History
    const historyPattern = /Length\s+of\s+Credit\s+History[:\s]*([^]*?)(?=Accounts\s+with\s+Negative|\n\n|\n\s*\n)/i;
    const historyMatch = summarySection.match(historyPattern);
    if (historyMatch && historyMatch[1]) {
      summary.lengthOfCreditHistory = historyMatch[1].trim().replace(/\s+/g, ' ');
    }
    
    // Accounts with Negative Information
    const negInfoPattern = /Accounts\s+with\s+Negative\s+Information[:\s]*(\d+)/i;
    const negInfoMatch = summarySection.match(negInfoPattern);
    if (negInfoMatch && negInfoMatch[1]) {
      summary.accountsWithNegativeInfo = negInfoMatch[1].trim();
    }
    
    // Oldest Account - pattern: Oldest Account: ACCOUNT_NAME (Opened MMM DD, YYYY)
    const oldestAccountPattern = /Oldest\s+Account[:\s]*([^(]+)\s*\(Opened\s+([^)]+)\)/i;
    const oldestAccountMatch = summarySection.match(oldestAccountPattern);
    if (oldestAccountMatch && oldestAccountMatch[1] && oldestAccountMatch[2]) {
      summary.oldestAccount = {
        accountName: oldestAccountMatch[1].trim(),
        openDate: oldestAccountMatch[2].trim()
      };
    }
    
    // Most Recent Account - pattern: Most Recent Account: ACCOUNT_NAME (Opened MMM DD, YYYY)
    const recentAccountPattern = /(?:Most\s+Recent|Newest)\s+Account[:\s]*([^(]+)\s*\(Opened\s+([^)]+)\)/i;
    const recentAccountMatch = summarySection.match(recentAccountPattern);
    if (recentAccountMatch && recentAccountMatch[1] && recentAccountMatch[2]) {
      summary.recentAccount = {
        accountName: recentAccountMatch[1].trim(),
        openDate: recentAccountMatch[2].trim()
      };
    }
    
    // If we don't have the negative info count yet, try a broader search
    if (!summary.accountsWithNegativeInfo) {
      const altNegPattern = /with\s+negative\s+information[:\s]*(\d+)/i;
      const altNegMatch = text.match(altNegPattern);
      if (altNegMatch && altNegMatch[1]) {
        summary.accountsWithNegativeInfo = altNegMatch[1];
      }
    }
    
    return summary;
  } catch (error) {
    console.error("Error extracting Equifax summary:", error);
    return {};
  }
};
