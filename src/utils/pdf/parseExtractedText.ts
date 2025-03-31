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
}

function enhanceAccountSummaries(parsedReport: any, extractedText: string) {
  console.log("Attempting to extract expanded account summaries");
  
  if (parsedReport.accountSummaries) {
    for (const summary of parsedReport.accountSummaries) {
      // Try to find with balance counts
      const withBalancePattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\b(\\d+)\\s+with\\s+balance\\b`, 'i');
      const withBalanceMatch = extractedText.match(withBalancePattern);
      if (withBalanceMatch && withBalanceMatch[1]) {
        summary.withBalance = parseInt(withBalanceMatch[1]);
      }
      
      // Try to find total balance
      const totalBalancePattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\btotal\\s+balance\\s*[:\\$]\\s*([\\d,.]+)\\b`, 'i');
      const totalBalanceMatch = extractedText.match(totalBalancePattern);
      if (totalBalanceMatch && totalBalanceMatch[1]) {
        summary.totalBalance = `$${totalBalanceMatch[1]}`;
      }
      
      // Try to find available credit
      const availablePattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\bavailable\\s*[:\\$]\\s*([\\d,.]+)\\b`, 'i');
      const availableMatch = extractedText.match(availablePattern);
      if (availableMatch && availableMatch[1]) {
        summary.available = `$${availableMatch[1]}`;
      }
      
      // Try to find credit limit
      const creditLimitPattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\bcredit\\s+limit\\s*[:\\$]\\s*([\\d,.]+)\\b`, 'i');
      const creditLimitMatch = extractedText.match(creditLimitPattern);
      if (creditLimitMatch && creditLimitMatch[1]) {
        summary.creditLimit = `$${creditLimitMatch[1]}`;
      }
      
      // Try to find debt to credit ratio
      const debtToCreditPattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\bdebt-to-credit\\s*:?\\s*(\\d+%)\\b`, 'i');
      const debtToCreditMatch = extractedText.match(debtToCreditPattern);
      if (debtToCreditMatch && debtToCreditMatch[1]) {
        summary.debtToCredit = debtToCreditMatch[1];
      }
      
      // Try to find payment amount
      const paymentPattern = new RegExp(`${summary.accountType}[\\s\\S]*?\\bpayment\\s*[:\\$]\\s*([\\d,.]+)\\b`, 'i');
      const paymentMatch = extractedText.match(paymentPattern);
      if (paymentMatch && paymentMatch[1]) {
        summary.payment = `$${paymentMatch[1]}`;
      }
    }
  }
}

function extractCreditMetrics(parsedReport: any, extractedText: string) {
  // Extract statement count
  const statementPattern = /statement[:\s]*(\d+)(?:\s*Records?)?\s*Found/i;
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
