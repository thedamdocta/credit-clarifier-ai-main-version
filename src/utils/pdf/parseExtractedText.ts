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
    
    // Extract expanded account table data if available
    const expandedTablePattern = /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i;
    if (expandedTablePattern.test(extractedText)) {
      enhanceAccountSummaries(parsedReport, extractedText);
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

function enhanceAccountSummaries(parsedReport: any, extractedText: string) {
  console.log("Attempting to extract expanded account summaries");
  
  if (parsedReport.accountSummaries && parsedReport.accountSummaries.length > 0) {
    // First extract main content containing account summaries table
    const tableSectionMatch = extractedText.match(/Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment([\s\S]+?)(?:Summary of|Statement|Public Records|Other Items)/i);
    const tableSection = tableSectionMatch ? tableSectionMatch[1] : extractedText;
    
    // Process each account summary individually
    for (const summary of parsedReport.accountSummaries) {
      // Look for a line specifically containing this account type
      const accountTypeRegex = new RegExp(`\\b${summary.accountType}\\b[^\\n]*`, 'i');
      const accountLine = tableSection.match(accountTypeRegex);
      
      if (accountLine && accountLine[0]) {
        const line = accountLine[0].trim();
        console.log(`Found account data for ${summary.accountType}:`, line);
        
        // Extract values from this specific line
        
        // Extract open accounts - first number after account type
        const openMatch = line.match(new RegExp(`\\b${summary.accountType}\\b\\s+(\\d+)`));
        if (openMatch && openMatch[1]) {
          summary.open = parseInt(openMatch[1]);
        }
        
        // Extract withBalance - should be the second number in the line
        const lineData = line.split(/\s+/);
        const accountTypeIndex = lineData.findIndex(part => 
          part.toLowerCase() === summary.accountType.toLowerCase());
          
        if (accountTypeIndex >= 0 && lineData.length > accountTypeIndex + 2) {
          const potentialWithBalance = lineData[accountTypeIndex + 2];
          if (/^\d+$/.test(potentialWithBalance)) {
            summary.withBalance = parseInt(potentialWithBalance);
          }
        }
        
        // Extract dollar amounts in order: totalBalance, available, creditLimit, payment
        const dollarValues = line.match(/\$[\d,.]+/g);
        if (dollarValues) {
          // Ensure we don't overwrite existing values with null
          if (dollarValues.length > 0 && !summary.totalBalance) 
            summary.totalBalance = dollarValues[0];
            
          if (dollarValues.length > 1 && !summary.available) 
            summary.available = dollarValues[1];
            
          if (dollarValues.length > 2 && !summary.creditLimit) 
            summary.creditLimit = dollarValues[2];
            
          if (dollarValues.length > 3 && !summary.payment) 
            summary.payment = dollarValues[3];
        }
        
        // Extract debt to credit ratio - should be a percentage
        const debtToCreditMatch = line.match(/(\d+\.?\d*%)/);
        if (debtToCreditMatch && debtToCreditMatch[1]) {
          summary.debtToCredit = debtToCreditMatch[1];
        }
      }
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
