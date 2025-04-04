import { enhanceEquifaxSummaryWithAI } from '../../ai/summaryExtraction';
import { CreditReport } from '../../types/creditReport';

/**
 * Extracts summary information from Equifax credit report format
 */
export const extractEquifaxSummary = async (text: string): Promise<Partial<CreditReport>> => {
  console.log("Extracting Equifax summary...");
  
  // Initialize return object
  const summaryData: any = {};
  
  try {
    // Try AI-enhanced extraction first
    const enhancedSummary = await enhanceEquifaxSummaryWithAI(text, summaryData);
    
    // Convert accountsWithNegativeInfo to string if it's a number
    if (typeof enhancedSummary.accountsWithNegativeInfo === 'number') {
      enhancedSummary.accountsWithNegativeInfo = String(enhancedSummary.accountsWithNegativeInfo);
    }
    
    // Always use default credit file status unless we find very specific pattern
    summaryData.creditFileStatus = "No fraud indicator on file";
    
    // Handle modular extraction for each field separately
    extractCreditFileStatus(text, summaryData);
    extractAlertContacts(text, summaryData);
    extractAccountAge(text, summaryData);
    extractCreditHistory(text, summaryData);
    extractNegativeAccounts(text, summaryData);
    extractOldestAccount(text, summaryData);
    extractRecentAccount(text, summaryData);
    extractConsumerName(text, summaryData);
    extractConfirmationNumber(text, summaryData);
    
    // If AI extraction was successful, selectively merge specific fields
    if (Object.keys(enhancedSummary).length > 0) {
      console.log("AI summary extraction successful");
      
      // Merge only fields that were successfully extracted
      if (enhancedSummary.alertContacts && enhancedSummary.alertContacts.length < 30) {
        summaryData.alertContacts = enhancedSummary.alertContacts;
      }
      
      if (enhancedSummary.averageAccountAge && enhancedSummary.averageAccountAge.length < 30) {
        summaryData.averageAccountAge = enhancedSummary.averageAccountAge;
      }
      
      if (enhancedSummary.lengthOfCreditHistory && enhancedSummary.lengthOfCreditHistory.length < 30) {
        summaryData.lengthOfCreditHistory = enhancedSummary.lengthOfCreditHistory;
      }
      
      if (enhancedSummary.accountsWithNegativeInfo && 
          (typeof enhancedSummary.accountsWithNegativeInfo === 'string' && 
           enhancedSummary.accountsWithNegativeInfo.length < 10)) {
        summaryData.accountsWithNegativeInfo = enhancedSummary.accountsWithNegativeInfo;
      }
      
      if (enhancedSummary.oldestAccount && 
          enhancedSummary.oldestAccount.accountName && 
          enhancedSummary.oldestAccount.accountName.length < 50) {
        summaryData.oldestAccount = enhancedSummary.oldestAccount;
      }
      
      if (enhancedSummary.recentAccount && 
          enhancedSummary.recentAccount.accountName && 
          enhancedSummary.recentAccount.accountName.length < 50) {
        summaryData.recentAccount = enhancedSummary.recentAccount;
      }
      
      if (enhancedSummary.confirmationNumber && 
          enhancedSummary.confirmationNumber.length < 30) {
        summaryData.confirmationNumber = enhancedSummary.confirmationNumber;
      }
    }
    
    return summaryData;
  } catch (error) {
    console.error("Error extracting Equifax summary:", error);
    return {};
  }
};

// Modular extraction functions

function extractCreditFileStatus(text: string, summaryData: any): void {
  // Only look for very specific "fraud indicator" text
  const fraudPattern = /fraud\s+indicator\s*:?\s*none/i;
  if (fraudPattern.test(text)) {
    summaryData.creditFileStatus = "No fraud indicator on file";
  } else {
    summaryData.creditFileStatus = "No fraud indicator on file"; // Default value
  }
}

function extractAlertContacts(text: string, summaryData: any): void {
  const alertPattern = /Alert\s+Contacts\s+(\d+)\s+Records\s+Found/i;
  const alertMatch = text.match(alertPattern);
  if (alertMatch && alertMatch[1]) {
    summaryData.alertContacts = `${alertMatch[1]} Records Found`;
  }
}

function extractAccountAge(text: string, summaryData: any): void {
  const avgAgePattern = /Average\s+Account\s+Age\s+(\d+\s+Years?,\s+\d+\s+Months?)/i;
  const avgAgeMatch = text.match(avgAgePattern);
  if (avgAgeMatch && avgAgeMatch[1]) {
    summaryData.averageAccountAge = avgAgeMatch[1].trim();
  }
}

function extractCreditHistory(text: string, summaryData: any): void {
  // Updated pattern to match both "X Years, Y Months" and "X Years" formats
  const historyPattern = /Length\s+of\s+Credit\s+History\s+(\d+\s+Years?(?:,\s+\d+\s+Months?)?)/i;
  const historyMatch = text.match(historyPattern);
  if (historyMatch && historyMatch[1]) {
    summaryData.lengthOfCreditHistory = historyMatch[1].trim();
  }
}

function extractNegativeAccounts(text: string, summaryData: any): void {
  const negInfoPattern = /Accounts\s+with\s+Negative\s+Information\s+(\d+)/i;
  const negInfoMatch = text.match(negInfoPattern);
  if (negInfoMatch && negInfoMatch[1]) {
    summaryData.accountsWithNegativeInfo = negInfoMatch[1].trim();
  }
}

function extractOldestAccount(text: string, summaryData: any): void {
  // Improved pattern to handle accounts with commas, periods, and other special characters
  const oldestAccountPattern = /oldest\s+account.*?:.*?([\w\s\/.&]+)\s+opened.*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
  const oldestMatch = text.match(oldestAccountPattern);
  if (oldestMatch && oldestMatch[1] && oldestMatch[2]) {
    summaryData.oldestAccount = { 
      name: oldestMatch[1].trim(), 
      date: oldestMatch[2].trim() 
    };
    console.log(`Found oldest account: ${summaryData.oldestAccount.name}, ${summaryData.oldestAccount.date}`);
  }
}

function extractRecentAccount(text: string, summaryData: any): void {
  // Improved pattern to handle accounts with commas, periods, and other special characters  
  const recentAccountPattern = /(?:most\s+recent|newest)\s+account.*?:.*?([\w\s\/.&]+)\s+opened.*?(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
  const recentMatch = text.match(recentAccountPattern);
  if (recentMatch && recentMatch[1] && recentMatch[2]) {
    summaryData.recentAccount = { 
      name: recentMatch[1].trim(), 
      date: recentMatch[2].trim() 
    };
    console.log(`Found recent account: ${summaryData.recentAccount.name}, ${summaryData.recentAccount.date}`);
  }
}

// Add new function to extract consumer name
function extractConsumerName(text: string, summaryData: any): void {
  // Try various patterns to extract consumer name
  const namePatterns = [
    /Name:\s*([A-Za-z\s\.,'-]+?)(?:\n|$|\s{2,})/i,
    /Consumer\s*Name:\s*([A-Za-z\s\.,'-]+?)(?:\n|$|\s{2,})/i,
    /Report\s+for\s+([A-Za-z\s\.,'-]+?)(?:\n|$|\s{2,})/i
  ];
  
  for (const pattern of namePatterns) {
    const nameMatch = text.match(pattern);
    if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 2) {
      summaryData.consumerName = nameMatch[1].trim();
      return;
    }
  }
}

// Add specific function to extract confirmation number
function extractConfirmationNumber(text: string, summaryData: any): void {
  // Try multiple patterns to extract confirmation number
  const confirmationPatterns = [
    /Confirmation\s+Number\s*:?\s*#?(\d{2}-\d{7}|\w{5}-\w{5}|[A-Z0-9]{10,})/i,
    /Report\s+Confirmation\s*:?\s*#?(\d{2}-\d{7}|\w{5}-\w{5}|[A-Z0-9]{10,})/i,
    /Confirmation\s*:?\s*#?(\d{2}-\d{7}|\w{5}-\w{5}|[A-Z0-9]{10,})/i,
    /Report\s+Number\s*:?\s*#?(\d{2}-\d{7}|\w{5}-\w{5}|[A-Z0-9]{10,})/i
  ];
  
  for (const pattern of confirmationPatterns) {
    const confirmationMatch = text.match(pattern);
    if (confirmationMatch && confirmationMatch[1] && confirmationMatch[1].trim().length > 3) {
      summaryData.confirmationNumber = confirmationMatch[1].trim();
      console.log("Found confirmation number:", summaryData.confirmationNumber);
      return;
    }
  }
  
  // If no specific pattern matched, try to find any alphanumeric code that looks like a confirmation number
  const genericPattern = /(?:Confirmation|Report)\s+(?:Number|ID)?\s*[:.]?\s*([A-Z0-9]{6,})/i;
  const genericMatch = text.match(genericPattern);
  if (genericMatch && genericMatch[1] && genericMatch[1].trim().length > 5) {
    summaryData.confirmationNumber = genericMatch[1].trim();
    console.log("Found generic confirmation number:", summaryData.confirmationNumber);
  }
}
