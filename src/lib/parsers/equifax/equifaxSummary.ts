
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
    
    // Always use default credit file status unless we find very specific pattern
    summary.creditFileStatus = "No fraud indicator on file";
    
    // Handle modular extraction for each field separately
    extractCreditFileStatus(text, summary);
    extractAlertContacts(text, summary);
    extractAccountAge(text, summary);
    extractCreditHistory(text, summary);
    extractNegativeAccounts(text, summary);
    extractOldestAccount(text, summary);
    extractRecentAccount(text, summary);
    
    // If AI extraction was successful, selectively merge specific fields
    if (Object.keys(enhancedSummary).length > 0) {
      console.log("AI summary extraction successful");
      
      // Merge only fields that were successfully extracted
      if (enhancedSummary.alertContacts && enhancedSummary.alertContacts.length < 30) {
        summary.alertContacts = enhancedSummary.alertContacts;
      }
      
      if (enhancedSummary.averageAccountAge && enhancedSummary.averageAccountAge.length < 30) {
        summary.averageAccountAge = enhancedSummary.averageAccountAge;
      }
      
      if (enhancedSummary.lengthOfCreditHistory && enhancedSummary.lengthOfCreditHistory.length < 30) {
        summary.lengthOfCreditHistory = enhancedSummary.lengthOfCreditHistory;
      }
      
      if (enhancedSummary.accountsWithNegativeInfo && 
          (typeof enhancedSummary.accountsWithNegativeInfo === 'string' && 
           enhancedSummary.accountsWithNegativeInfo.length < 10)) {
        summary.accountsWithNegativeInfo = enhancedSummary.accountsWithNegativeInfo;
      }
      
      if (enhancedSummary.oldestAccount && 
          enhancedSummary.oldestAccount.accountName && 
          enhancedSummary.oldestAccount.accountName.length < 50) {
        summary.oldestAccount = enhancedSummary.oldestAccount;
      }
      
      if (enhancedSummary.recentAccount && 
          enhancedSummary.recentAccount.accountName && 
          enhancedSummary.recentAccount.accountName.length < 50) {
        summary.recentAccount = enhancedSummary.recentAccount;
      }
    }
    
    return summary;
  } catch (error) {
    console.error("Error extracting Equifax summary:", error);
    return {};
  }
};

// Modular extraction functions

function extractCreditFileStatus(text: string, summary: any): void {
  // Only look for very specific "fraud indicator" text
  const fraudPattern = /fraud\s+indicator\s*:?\s*none/i;
  if (fraudPattern.test(text)) {
    summary.creditFileStatus = "No fraud indicator on file";
  } else {
    summary.creditFileStatus = "No fraud indicator on file"; // Default value
  }
}

function extractAlertContacts(text: string, summary: any): void {
  const alertPattern = /Alert\s+Contacts\s+(\d+)\s+Records\s+Found/i;
  const alertMatch = text.match(alertPattern);
  if (alertMatch && alertMatch[1]) {
    summary.alertContacts = `${alertMatch[1]} Records Found`;
  }
}

function extractAccountAge(text: string, summary: any): void {
  const avgAgePattern = /Average\s+Account\s+Age\s+(\d+\s+Years?,\s+\d+\s+Months?)/i;
  const avgAgeMatch = text.match(avgAgePattern);
  if (avgAgeMatch && avgAgeMatch[1]) {
    summary.averageAccountAge = avgAgeMatch[1].trim();
  }
}

function extractCreditHistory(text: string, summary: any): void {
  const historyPattern = /Length\s+of\s+Credit\s+History\s+(\d+\s+Years?)/i;
  const historyMatch = text.match(historyPattern);
  if (historyMatch && historyMatch[1]) {
    summary.lengthOfCreditHistory = historyMatch[1].trim();
  }
}

function extractNegativeAccounts(text: string, summary: any): void {
  const negInfoPattern = /Accounts\s+with\s+Negative\s+Information\s+(\d+)/i;
  const negInfoMatch = text.match(negInfoPattern);
  if (negInfoMatch && negInfoMatch[1]) {
    summary.accountsWithNegativeInfo = negInfoMatch[1].trim();
  }
}

function extractOldestAccount(text: string, summary: any): void {
  const oldestAccountPattern = /Oldest\s+Account\s+([\w\s\/]+)\s+\(Opened\s+([^)]+)\)/i;
  const oldestAccountMatch = text.match(oldestAccountPattern);
  if (oldestAccountMatch && oldestAccountMatch[1] && oldestAccountMatch[2]) {
    summary.oldestAccount = {
      accountName: oldestAccountMatch[1].trim(),
      openDate: oldestAccountMatch[2].trim()
    };
  }
}

function extractRecentAccount(text: string, summary: any): void {
  const recentAccountPattern = /(?:Most\s+Recent|Newest)\s+Account\s+([\w\s\/]+)\s+\(Opened\s+([^)]+)\)/i;
  const recentAccountMatch = text.match(recentAccountPattern);
  if (recentAccountMatch && recentAccountMatch[1] && recentAccountMatch[2]) {
    summary.recentAccount = {
      accountName: recentAccountMatch[1].trim(),
      openDate: recentAccountMatch[2].trim()
    };
  }
}
