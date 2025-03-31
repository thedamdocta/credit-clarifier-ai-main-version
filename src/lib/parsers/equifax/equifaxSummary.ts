
import { enhanceEquifaxSummaryWithAI } from '../../ai/summaryExtraction';
import { CreditReport } from '../../types/creditReport';

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
    
    // Convert accountsWithNegativeInfo to string if it's a number
    if (typeof enhancedSummary.accountsWithNegativeInfo === 'number') {
      enhancedSummary.accountsWithNegativeInfo = String(enhancedSummary.accountsWithNegativeInfo);
    }
    
    // Improved extraction for credit file status
    if (!enhancedSummary.creditFileStatus) {
      const noFraudPattern = /no\s+fraud\s+indicator\s+on\s+file/i;
      const noFraudMatch = text.match(noFraudPattern);
      if (noFraudMatch) {
        enhancedSummary.creditFileStatus = "No fraud indicator on file";
      } else {
        // Look for Credit File Status directly
        const fileStatusPattern = /credit\s+file\s+status[:\s]*([^.\n]+)/i;
        const fileStatusMatch = text.match(fileStatusPattern);
        if (fileStatusMatch && fileStatusMatch[1]) {
          enhancedSummary.creditFileStatus = fileStatusMatch[1].trim();
        }
      }
    }
    
    // If AI extraction was successful, return the enhanced summary
    if (Object.keys(enhancedSummary).length > 0) {
      console.log("AI summary extraction successful");
      return enhancedSummary as {
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
      };
    }
    
    // Fallback to traditional extraction if AI extraction failed
    console.log("Falling back to traditional summary extraction...");
    
    // Look for Credit File Status directly
    const fileStatusPattern = /Credit\s+File\s+Status[:\s]*([^]*?)(?=Alert\s+Contacts|\n\n)/i;
    const fileStatusMatch = text.match(fileStatusPattern);
    if (fileStatusMatch && fileStatusMatch[1]) {
      summary.creditFileStatus = fileStatusMatch[1].trim().replace(/\s+/g, ' ');
    } else {
      // If not found, look for "No fraud indicator on file"
      const fraudPattern = /No\s+fraud\s+indicator\s+on\s+file/i;
      const fraudMatch = text.match(fraudPattern);
      if (fraudMatch) {
        summary.creditFileStatus = "No fraud indicator on file";
      }
    }
    
    // Extract Alert Contacts - look for pattern like "Alert Contacts 0 Records Found"
    const alertPattern = /Alert\s+Contacts\s+(\d+)\s+Records\s+Found/i;
    const alertMatch = text.match(alertPattern);
    if (alertMatch && alertMatch[1]) {
      summary.alertContacts = `${alertMatch[1]} Records Found`;
    }
    
    // Extract Average Account Age - look for X Years, Y Months format
    const avgAgePattern = /Average\s+Account\s+Age\s+(\d+\s+Years?,\s+\d+\s+Months?)/i;
    const avgAgeMatch = text.match(avgAgePattern);
    if (avgAgeMatch && avgAgeMatch[1]) {
      summary.averageAccountAge = avgAgeMatch[1].trim();
    }
    
    // Extract Length of Credit History - typically X Years format
    const historyPattern = /Length\s+of\s+Credit\s+History\s+(\d+\s+Years?)/i;
    const historyMatch = text.match(historyPattern);
    if (historyMatch && historyMatch[1]) {
      summary.lengthOfCreditHistory = historyMatch[1].trim();
    }
    
    // Extract Accounts with Negative Information
    const negInfoPattern = /Accounts\s+with\s+Negative\s+Information\s+(\d+)/i;
    const negInfoMatch = text.match(negInfoPattern);
    if (negInfoMatch && negInfoMatch[1]) {
      summary.accountsWithNegativeInfo = negInfoMatch[1].trim();
    }
    
    // Extract Oldest Account - pattern: Oldest Account DEPT OF ED/AIDVANTAGE (Opened Dec 15, 2011)
    const oldestAccountPattern = /Oldest\s+Account\s+([\w\s\/]+)\s+\(Opened\s+([^)]+)\)/i;
    const oldestAccountMatch = text.match(oldestAccountPattern);
    if (oldestAccountMatch && oldestAccountMatch[1] && oldestAccountMatch[2]) {
      summary.oldestAccount = {
        accountName: oldestAccountMatch[1].trim(),
        openDate: oldestAccountMatch[2].trim()
      };
    }
    
    // Extract Most Recent Account - pattern: Most Recent Account AMERICAN CREDIT ACCEPTANCE (Opened Jul 12, 2023)
    const recentAccountPattern = /(?:Most\s+Recent|Newest)\s+Account\s+([\w\s\/]+)\s+\(Opened\s+([^)]+)\)/i;
    const recentAccountMatch = text.match(recentAccountPattern);
    if (recentAccountMatch && recentAccountMatch[1] && recentAccountMatch[2]) {
      summary.recentAccount = {
        accountName: recentAccountMatch[1].trim(),
        openDate: recentAccountMatch[2].trim()
      };
    }
    
    return summary;
  } catch (error) {
    console.error("Error extracting Equifax summary:", error);
    return {};
  }
};
