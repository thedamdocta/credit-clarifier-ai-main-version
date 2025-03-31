
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
    
    // Extract each piece of information separately using focused functions
    extractAlertContactsAI(summarySection, summaryData);
    extractAverageAccountAgeAI(summarySection, summaryData);
    extractCreditHistoryLengthAI(summarySection, summaryData);
    extractNegativeAccountsAI(summarySection, summaryData);
    extractOldestAccountAI(summarySection, summaryData);
    extractRecentAccountAI(summarySection, summaryData);
    
    // Extract statements count
    extractStatementsCountAI(text, summaryData);
    
    return summaryData;
  } catch (error) {
    console.error("Error extracting summary with AI:", error);
    return {};
  }
};

// Modular AI extraction functions with more precise boundaries
function extractAlertContactsAI(text: string, data: Partial<CreditReport>): void {
  const alertMatch = text.match(/Alert\s*Contacts\s*:?\s*(\d+)\s*Records?\s*Found(?:\s|$|\n)/i);
  if (alertMatch && alertMatch[1]) {
    data.alertContacts = alertMatch[1].trim() + " Records Found";
    console.log("Extracted alert contacts:", data.alertContacts);
  }
}

function extractAverageAccountAgeAI(text: string, data: Partial<CreditReport>): void {
  const ageMatch = text.match(/Average\s*Account\s*Age\s*:?\s*(\d+\s*Years?,\s*\d+\s*Months?)(?:\s|$|\n)/i);
  if (ageMatch && ageMatch[1]) {
    data.averageAccountAge = ageMatch[1].trim();
    console.log("Extracted average account age:", data.averageAccountAge);
  }
}

function extractCreditHistoryLengthAI(text: string, data: Partial<CreditReport>): void {
  // Updated pattern to match both "X Years, Y Months" and "X Years" formats
  const historyMatch = text.match(/Length\s*of\s*Credit\s*History\s*:?\s*(\d+\s*Years?(?:,\s*\d+\s*Months?)?)(?:\s|$|\n)/i);
  if (historyMatch && historyMatch[1]) {
    data.lengthOfCreditHistory = historyMatch[1].trim();
    console.log("Extracted credit history length:", data.lengthOfCreditHistory);
  }
}

function extractNegativeAccountsAI(text: string, data: Partial<CreditReport>): void {
  const negInfoMatch = text.match(/Accounts\s*with\s*Negative\s*Information\s*:?\s*(\d+)(?:\s|$|\n)/i);
  if (negInfoMatch && negInfoMatch[1]) {
    data.accountsWithNegativeInfo = negInfoMatch[1].trim();
    console.log("Extracted accounts with negative info:", data.accountsWithNegativeInfo);
  }
}

function extractOldestAccountAI(text: string, data: Partial<CreditReport>): void {
  const oldestAccountMatch = text.match(/Oldest\s*Account\s*:?\s*([\w\s\/]+?)\s*\(Opened\s+([^)]+)\)(?:\s|$|\n)/i);
  if (oldestAccountMatch && oldestAccountMatch[1] && oldestAccountMatch[2]) {
    data.oldestAccount = {
      accountName: oldestAccountMatch[1].trim(),
      openDate: oldestAccountMatch[2].trim()
    };
    console.log("Extracted oldest account:", data.oldestAccount);
  }
}

function extractRecentAccountAI(text: string, data: Partial<CreditReport>): void {
  const recentAccountMatch = text.match(/(?:Most\s*Recent|Newest)\s*Account\s*:?\s*([\w\s\/]+?)\s*\(Opened\s+([^)]+)\)(?:\s|$|\n)/i);
  if (recentAccountMatch && recentAccountMatch[1] && recentAccountMatch[2]) {
    data.recentAccount = {
      accountName: recentAccountMatch[1].trim(),
      openDate: recentAccountMatch[2].trim()
    };
    console.log("Extracted most recent account:", data.recentAccount);
  }
}

function extractStatementsCountAI(text: string, data: Partial<CreditReport>): void {
  // More specific pattern to look for "X Statement(s) Found"
  const statementMatch = text.match(/(?:Consumer\s*)?Statements?\s*:?\s*(\d+)\s*(?:Statement|Statements|Record|Records)?\s*Found/i);
  if (statementMatch && statementMatch[1]) {
    const count = parseInt(statementMatch[1].trim());
    data.statementCount = count;
    console.log("Extracted statement count:", count);
  }
}

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
