import { toast } from "sonner";
import { parseCreditReport } from "@/lib/creditReportParser";

export const identifyDocumentPatterns = (extractedText: string) => {
  // Pre-process text to better identify account tables
  // Look for Equifax specific table patterns
  const tablePattern = /Account\s+Type\s+(?:Total\s+Accounts|Open|Closed|Balance)/i;
  if (tablePattern.test(extractedText)) {
    console.log("Identified potential Equifax account summary table");
  }
  
  // Look for the expanded table format
  const expandedTablePattern = /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i;
  if (expandedTablePattern.test(extractedText)) {
    console.log("Identified expanded Equifax account summary table");
  }
  
  // Extract patterns from text
  const patterns = {
    confirmationNumber: extractConfirmationNumber(extractedText),
    creditFileStatus: extractCreditFileStatus(extractedText),
    recentInquiry: extractRecentInquiry(extractedText),
  };
  
  return patterns;
};

export const extractConfirmationNumber = (text: string): string | null => {
  // Look for a report confirmation number with specific format - typically a 10-digit number
  const reportConfirmPattern = /report\s+confirmation(?:\s*number)?[:\s]*(\d{9,10})(?:\s|$|\n)/i;
  const reportConfirmMatch = text.match(reportConfirmPattern);
  if (reportConfirmMatch && reportConfirmMatch[1]) {
    console.log("Found report confirmation number:", reportConfirmMatch[1]);
    return reportConfirmMatch[1].trim();
  }
  
  // Try another pattern specific to Equifax format
  const confirmationPattern = /confirmation\s+number[:\s]*(\d{9,10})(?:\s|$|\n)/i;
  const confirmationMatch = text.match(confirmationPattern);
  if (confirmationMatch && confirmationMatch[1]) {
    console.log("Found confirmation number:", confirmationMatch[1]);
    return confirmationMatch[1].trim();
  }
  
  // Look for a standalone 9-10 digit number near the beginning (may be report confirmation)
  const headerSection = text.substring(0, 2000);
  const standaloneConfirmPattern = /^\s*(\d{9,10})\s*$/m;
  const standaloneMatch = headerSection.match(standaloneConfirmPattern);
  if (standaloneMatch && standaloneMatch[1]) {
    console.log("Found standalone confirmation number:", standaloneMatch[1]);
    return standaloneMatch[1].trim();
  }
  
  return null;
};

export const extractCreditFileStatus = (text: string): string | null => {
  // First try exact pattern with clear boundaries
  const statusPattern = /credit\s+file\s+status[:\s]*(.*?)(?:\n|$|\s+Alert\s+Contacts|\s+Average\s+Account)/i;
  const statusMatch = text.match(statusPattern);
  if (statusMatch && statusMatch[1]) {
    const status = statusMatch[1].trim();
    console.log("Found credit file status:", status);
    return status;
  }
  
  // Try for "No fraud indicator" pattern specifically
  const fraudPattern = /No\s+fraud\s+indicator\s+on\s+file(?:\s|$|\n)/i;
  const fraudMatch = text.match(fraudPattern);
  if (fraudMatch) {
    console.log("Found no fraud indicator statement");
    return "No fraud indicator on file";
  }
  
  return null;
};

export const extractRecentInquiry = (text: string): string | null => {
  const recentInquiryPattern = /Most\s+Recent\s+Inquiry[:\s]+([^\n]+?)(?:\n|$)/i;
  const recentInquiryMatch = text.match(recentInquiryPattern);
  if (recentInquiryMatch && recentInquiryMatch[1]) {
    console.log("Found most recent inquiry:", recentInquiryMatch[1].trim());
    return recentInquiryMatch[1].trim();
  }
  return null;
};

export const enhanceEquifaxReport = (parsedReport: any, extractedText: string) => {
  if (parsedReport.bureau === 'Equifax') {
    // Extract confirmation number
    const confirmationNumber = extractConfirmationNumber(extractedText);
    if (confirmationNumber) {
      parsedReport.confirmationNumber = confirmationNumber;
    }
    
    // Extract credit file status
    const creditFileStatus = extractCreditFileStatus(extractedText);
    if (creditFileStatus) {
      parsedReport.creditFileStatus = creditFileStatus;
    } else if (!parsedReport.creditFileStatus) {
      parsedReport.creditFileStatus = "No fraud indicator on file";
    }
    
    // Extract most recent inquiry in a cleaner format
    const recentInquiry = extractRecentInquiry(extractedText);
    if (recentInquiry && recentInquiry.length < 100) {
      parsedReport.recentInquiry = recentInquiry;
    }
    
    // Extract key summary data with highly targeted approaches
    extractSummaryData(parsedReport, extractedText);
    
    // Extract account summaries if needed - but don't override properly extracted data
    // We'll improve this function to respect null values and empty cells
    const expandedTablePattern = /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i;
    if (expandedTablePattern.test(extractedText) && parsedReport.accountSummaries) {
      enhanceAccountSummariesCellByCellApproach(parsedReport, extractedText);
    }
    
    // Additional Equifax-specific enhancements
    extractCreditMetrics(parsedReport, extractedText);
    findOldestAndMostRecentAccounts(parsedReport, extractedText);
  }
  
  return parsedReport;
};

function extractSummaryData(parsedReport: any, extractedText: string) {
  // Extract alert contacts with more precise boundaries
  if (!parsedReport.alertContacts) {
    const alertPattern = /Alert\s+Contacts\s+(\d+\s+Records\s+Found)(?:\s|$|\n)/i;
    const alertMatch = extractedText.match(alertPattern);
    if (alertMatch && alertMatch[1]) {
      parsedReport.alertContacts = alertMatch[1].trim();
    }
  }
  
  // Extract average account age with more precise boundaries
  if (!parsedReport.averageAccountAge) {
    const agePattern = /Average\s+Account\s+Age\s+(\d+\s+Years?,\s+\d+\s+Months?)(?:\s|$|\n)/i;
    const ageMatch = extractedText.match(agePattern);
    if (ageMatch && ageMatch[1]) {
      parsedReport.averageAccountAge = ageMatch[1].trim();
    }
  }
  
  // Extract length of credit history with more precise boundaries - updated to match both years and months
  if (!parsedReport.lengthOfCreditHistory) {
    const historyPattern = /Length\s+of\s+Credit\s+History\s+(\d+\s+Years?(?:,\s+\d+\s+Months?)?)(?:\s|$|\n)/i;
    const historyMatch = extractedText.match(historyPattern);
    if (historyMatch && historyMatch[1]) {
      parsedReport.lengthOfCreditHistory = historyMatch[1].trim();
    }
  }
  
  // Extract accounts with negative information with more precise boundaries
  if (!parsedReport.accountsWithNegativeInfo) {
    const negativeInfoPattern = /Accounts\s+with\s+Negative\s+Information\s*:?\s*(\d+)(?:\s|$|\n)/i;
    const negativeMatch = extractedText.match(negativeInfoPattern);
    if (negativeMatch && negativeMatch[1]) {
      parsedReport.accountsWithNegativeInfo = negativeMatch[1].trim();
    }
  }
  
  // Extract statement count with more specific patterns
  if (!parsedReport.statementCount) {
    const statementPattern = /(?:Consumer\s*)?Statements?\s*:?\s*(\d+)(?:\s*Statement|Statements|Record|Records)?\s*Found/i;
    const statementMatch = extractedText.match(statementPattern);
    if (statementMatch && statementMatch[1]) {
      parsedReport.statementCount = parseInt(statementMatch[1]);
    }
  }
}

function enhanceAccountSummariesCellByCellApproach(parsedReport: any, extractedText: string) {
  console.log("Attempting to extract expanded account summaries cell by cell");
  
  if (parsedReport.accountSummaries && parsedReport.accountSummaries.length > 0) {
    // Extract the table section
    const tableSectionMatch = extractedText.match(/Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment([\s\S]+?)(?:Summary of|Statement|Public Records|Other Items)/i);
    const tableSection = tableSectionMatch ? tableSectionMatch[1] : extractedText;
    
    // Split the table into lines for better processing
    const lines = tableSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Process each account type individually
    for (const summary of parsedReport.accountSummaries) {
      const accountType = summary.accountType;
      
      // Find the specific line containing just this account type's data
      const accountTypeLine = lines.find(line => 
        new RegExp(`^${accountType}\\b`, 'i').test(line)
      );
      
      if (accountTypeLine) {
        console.log(`Found account data for ${accountType}:`, accountTypeLine);
        
        // Process this specific line for this specific account type
        processAccountLine(accountTypeLine, summary);
      }
    }
  }
}

function processAccountLine(line: string, summary: any) {
  const accountType = summary.accountType;
  
  // Split into tokens for easier processing
  const tokens = line.split(/\s+/);
  const accountTypeIndex = tokens.findIndex(t => 
    t.toLowerCase() === accountType.toLowerCase());
    
  if (accountTypeIndex >= 0) {
    // Open accounts - first number after account type if present
    let currentIndex = accountTypeIndex + 1;
    if (currentIndex < tokens.length && /^\d+$/.test(tokens[currentIndex])) {
      summary.open = parseInt(tokens[currentIndex]);
      currentIndex++;
    }
    
    // With Balance - second number if present
    if (currentIndex < tokens.length && /^\d+$/.test(tokens[currentIndex])) {
      summary.withBalance = parseInt(tokens[currentIndex]);
      currentIndex++;
    }
    
    // For dollar values, extract them in the correct context
    const accountTypePos = line.toLowerCase().indexOf(accountType.toLowerCase());
    const afterAccountType = line.substring(accountTypePos);
    
    // Get all dollar values in this line section
    const dollarMatches = afterAccountType.match(/\$[\d,.-]+/g);
    
    // Only process if we found dollar values
    if (dollarMatches) {
      // Find where the next account type starts (if any)
      let relevantSection = afterAccountType;
      const accountTypes = ['Revolving', 'Installment', 'Mortgage', 'Other', 'Total'];
      
      for (const type of accountTypes) {
        if (type === accountType) continue; // Skip the current account type
        
        // Find the next occurrence of another account type
        const nextTypeIndex = afterAccountType.indexOf(type);
        if (nextTypeIndex > -1 && nextTypeIndex < relevantSection.length) {
          relevantSection = afterAccountType.substring(0, nextTypeIndex);
        }
      }
      
      // Get dollar values only from the relevant section
      const relevantDollarMatches = relevantSection.match(/\$[\d,.-]+/g);
      
      if (relevantDollarMatches) {
        // Assign dollar values in order: totalBalance, available, creditLimit, payment
        if (relevantDollarMatches.length > 0) 
          summary.totalBalance = relevantDollarMatches[0];
          
        if (relevantDollarMatches.length > 1) 
          summary.available = relevantDollarMatches[1];
          
        if (relevantDollarMatches.length > 2) 
          summary.creditLimit = relevantDollarMatches[2];
          
        if (relevantDollarMatches.length > 3) 
          summary.payment = relevantDollarMatches[3];
      }
    }
    
    // Extract debt-to-credit percentage specific to this account
    const percentagePattern = new RegExp(`${accountType}[^%]*?(\\d+\\.?\\d*%)`, 'i');
    const percentageMatch = line.match(percentagePattern);
    
    if (percentageMatch && percentageMatch[1]) {
      summary.debtToCredit = percentageMatch[1];
    }
  }
}

function extractCreditMetrics(parsedReport: any, extractedText: string) {
  // Extract statement count with improved patterns for singular/plural forms
  const statementPattern = /(?:Consumer\s*)?Statements?\s*:?\s*(\d+)(?:\s*Statement|Statements|Record|Records)?\s*Found/i;
  const statementMatch = extractedText.match(statementPattern);
  if (statementMatch && statementMatch[1]) {
    parsedReport.statementCount = parseInt(statementMatch[1]);
  } else {
    parsedReport.statementCount = 0;
  }
  
  // Extract accounts with negative info if not already set
  if (!parsedReport.accountsWithNegativeInfo) {
    const negativeInfoPattern = /accounts\s+with\s+negative\s+information\s*:?\s*(\d+)/i;
    const negativeMatch = extractedText.match(negativeInfoPattern);
    if (negativeMatch && negativeMatch[1]) {
      parsedReport.accountsWithNegativeInfo = negativeMatch[1].trim();
    }
  }
}

function findOldestAndMostRecentAccounts(parsedReport: any, extractedText: string) {
  // Try direct pattern matching first for oldest account
  if (!parsedReport.oldestAccount) {
    const oldestAccountPattern = /Oldest\s+Account\s+([\w\s/]+)\s+\(Opened\s+([^)]+)\)/i;
    const oldestAccountMatch = extractedText.match(oldestAccountPattern);
    if (oldestAccountMatch && oldestAccountMatch[1] && oldestAccountMatch[2]) {
      parsedReport.oldestAccount = {
        accountName: oldestAccountMatch[1].trim(),
        openDate: oldestAccountMatch[2].trim()
      };
    }
  }
  
  // Try direct pattern matching first for most recent account
  if (!parsedReport.recentAccount) {
    const recentAccountPattern = /(?:Most\s+Recent|Newest)\s+Account\s+([\w\s/]+)\s+\(Opened\s+([^)]+)\)/i;
    const recentAccountMatch = extractedText.match(recentAccountPattern);
    if (recentAccountMatch && recentAccountMatch[1] && recentAccountMatch[2]) {
      parsedReport.recentAccount = {
        accountName: recentAccountMatch[1].trim(),
        openDate: recentAccountMatch[2].trim()
      };
    }
  }
  
  // If direct patterns didn't work and we have accounts, try to derive from accounts
  if ((!parsedReport.oldestAccount || !parsedReport.recentAccount) && 
      parsedReport.accounts && parsedReport.accounts.length > 0) {
    // Sort accounts by open date
    const sortedAccounts = [...parsedReport.accounts]
      .filter(account => account.openDate && account.openDate !== 'Not Found')
      .sort((a, b) => {
        const dateA = new Date(a.openDate).getTime();
        const dateB = new Date(b.openDate).getTime();
        return dateA - dateB;
      });
    
    if (sortedAccounts.length > 0) {
      if (!parsedReport.oldestAccount) {
        parsedReport.oldestAccount = {
          accountName: sortedAccounts[0].accountName,
          openDate: sortedAccounts[0].openDate
        };
      }
      
      if (!parsedReport.recentAccount) {
        parsedReport.recentAccount = {
          accountName: sortedAccounts[sortedAccounts.length - 1].accountName,
          openDate: sortedAccounts[sortedAccounts.length - 1].openDate
        };
      }
    }
  }
}

export const parsePDFContent = async (extractedText: string, useAI: boolean) => {
  try {
    console.log("Beginning report parsing...");
    
    // Show appropriate processing toast
    if (useAI) {
      toast.info("Processing with AI analysis...");
    } else {
      toast.info("Processing credit report...");
    }
    
    // Parse the report with or without AI-first approach
    const parsedReport = await parseCreditReport(extractedText, useAI);
    console.log("Report parsing complete:", parsedReport.bureau);
    
    // Extract additional information for the report
    const enhancedReport = enhanceEquifaxReport(parsedReport, extractedText);
    
    // Log account summary info for debugging
    if (enhancedReport.accountSummaries) {
      console.log("Account summaries extracted:", enhancedReport.accountSummaries.length);
      console.log("Account summaries:", enhancedReport.accountSummaries);
    }
    
    return enhancedReport;
  } catch (error) {
    console.error("Error in processing:", error);
    throw error;
  }
};
