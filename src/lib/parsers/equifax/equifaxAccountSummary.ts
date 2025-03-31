
import { AccountSummary } from "../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction for table structure");
  parsingLogger.logEvent("Starting equifax account summary extraction");
  
  // Define the empty account summaries structure 
  const accountSummaries: AccountSummary[] = [
    { accountType: 'Revolving', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Mortgage', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Installment', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Other', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Total', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null }
  ];

  try {
    // Extract each line that contains account type information
    const lines = extractAccountLines(text);
    if (lines.length === 0) {
      console.log("No account lines found in the text");
      parsingLogger.logEvent("No account lines found in the text");
      return accountSummaries;
    }
    
    // Process each line independently
    processRevolvingLine(lines, accountSummaries);
    processMortgageLine(lines, accountSummaries);
    processInstallmentLine(lines, accountSummaries);
    processOtherLine(lines, accountSummaries);
    processTotalLine(lines, accountSummaries);
    
    console.log("Account summaries extracted:", accountSummaries.length);
    console.log("Account summaries:", accountSummaries);
    parsingLogger.logEvent("Completed account summary extraction", { count: accountSummaries.length });
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

/**
 * Extract lines that contain account type information
 */
function extractAccountLines(text: string): string[] {
  // Split the text into lines
  const allLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Find the account type header line to establish the beginning of our table
  const headerIndex = allLines.findIndex(
    line => line.toLowerCase().includes('account type') && 
           line.toLowerCase().includes('open') && 
           line.toLowerCase().includes('with balance')
  );

  if (headerIndex === -1) {
    return [];
  }

  // Extract the relevant lines following the header
  const relevantLines = allLines.slice(headerIndex);
  
  return relevantLines.filter(line => {
    const lowerLine = line.toLowerCase();
    return (
      lowerLine.includes('revolving') ||
      lowerLine.includes('mortgage') ||
      lowerLine.includes('installment') ||
      (lowerLine.includes('other') && !lowerLine.includes('other items')) ||
      (lowerLine.includes('total') && !lowerLine.includes('total accounts'))
    );
  });
}

/**
 * Process Revolving lines specifically - treating values as text
 */
function processRevolvingLine(lines: string[], accountSummaries: AccountSummary[]): void {
  // Find lines that specifically contain "Revolving" as a standalone word
  const revolvingLines = lines.filter(line => {
    const words = line.split(/\s+/).map(word => word.trim().toLowerCase());
    return words.includes('revolving');
  });
  
  if (revolvingLines.length === 0) {
    console.log("No Revolving line found");
    return;
  }

  // Get the revolving line
  const revolvingLine = revolvingLines[0];
  console.log("Found Revolving line:", revolvingLine);
  
  // Extract data by looking for specific patterns in this line only
  const revolvingSummary = accountSummaries.find(s => s.accountType === 'Revolving');
  if (!revolvingSummary) return;
  
  // Create a regex pattern that specifically extracts "Revolving" followed by values
  // This pattern looks for "Revolving" followed by spaces, then captures numeric values
  const pattern = /revolving\s+(\S+)\s+(\S+)/i;
  const match = revolvingLine.match(pattern);
  
  if (match) {
    // The first captured group is the "Open" value
    const openValue = match[1];
    revolvingSummary.open = isNumeric(openValue) ? parseInt(openValue) : null;
    
    // The second captured group is the "With Balance" value
    const withBalanceValue = match[2];
    revolvingSummary.withBalance = isNumeric(withBalanceValue) ? parseInt(withBalanceValue) : null;
  }
  
  // Now look for dollar amounts specifically in the revolving line
  extractDollarValues(revolvingLine, revolvingSummary);
  
  // Extract debt-to-credit percentage
  extractPercentage(revolvingLine, revolvingSummary);
}

/**
 * Process Mortgage lines specifically - treating values as text
 */
function processMortgageLine(lines: string[], accountSummaries: AccountSummary[]): void {
  const mortgageLines = lines.filter(line => {
    const words = line.split(/\s+/).map(word => word.trim().toLowerCase());
    return words.includes('mortgage');
  });
  
  if (mortgageLines.length === 0) {
    console.log("No Mortgage line found");
    return;
  }

  const mortgageLine = mortgageLines[0];
  console.log("Found Mortgage line:", mortgageLine);
  
  const mortgageSummary = accountSummaries.find(s => s.accountType === 'Mortgage');
  if (!mortgageSummary) return;
  
  const pattern = /mortgage\s+(\S+)\s+(\S+)/i;
  const match = mortgageLine.match(pattern);
  
  if (match) {
    const openValue = match[1];
    mortgageSummary.open = isNumeric(openValue) ? parseInt(openValue) : null;
    
    const withBalanceValue = match[2];
    mortgageSummary.withBalance = isNumeric(withBalanceValue) ? parseInt(withBalanceValue) : null;
  }
  
  extractDollarValues(mortgageLine, mortgageSummary);
  extractPercentage(mortgageLine, mortgageSummary);
}

/**
 * Process Installment lines specifically - treating values as text
 */
function processInstallmentLine(lines: string[], accountSummaries: AccountSummary[]): void {
  const installmentLines = lines.filter(line => {
    const words = line.split(/\s+/).map(word => word.trim().toLowerCase());
    return words.includes('installment');
  });
  
  if (installmentLines.length === 0) {
    console.log("No Installment line found");
    return;
  }

  const installmentLine = installmentLines[0];
  console.log("Found Installment line:", installmentLine);
  
  const installmentSummary = accountSummaries.find(s => s.accountType === 'Installment');
  if (!installmentSummary) return;
  
  const pattern = /installment\s+(\S+)\s+(\S+)/i;
  const match = installmentLine.match(pattern);
  
  if (match) {
    const openValue = match[1];
    installmentSummary.open = isNumeric(openValue) ? parseInt(openValue) : null;
    
    const withBalanceValue = match[2];
    installmentSummary.withBalance = isNumeric(withBalanceValue) ? parseInt(withBalanceValue) : null;
  }
  
  extractDollarValues(installmentLine, installmentSummary);
  extractPercentage(installmentLine, installmentSummary);
}

/**
 * Process Other lines specifically - treating values as text
 */
function processOtherLine(lines: string[], accountSummaries: AccountSummary[]): void {
  // For "Other", we need to be careful not to match "Other Items"
  const otherLines = lines.filter(line => {
    const lowerLine = line.toLowerCase();
    // Make sure it contains "other" but not "other items"
    return lowerLine.includes('other') && !lowerLine.includes('other items');
  });
  
  if (otherLines.length === 0) {
    console.log("No Other line found");
    return;
  }

  const otherLine = otherLines[0];
  console.log("Found Other line:", otherLine);
  
  const otherSummary = accountSummaries.find(s => s.accountType === 'Other');
  if (!otherSummary) return;
  
  const pattern = /other\s+(\S+)\s+(\S+)/i;
  const match = otherLine.match(pattern);
  
  if (match) {
    const openValue = match[1];
    otherSummary.open = isNumeric(openValue) ? parseInt(openValue) : null;
    
    const withBalanceValue = match[2];
    otherSummary.withBalance = isNumeric(withBalanceValue) ? parseInt(withBalanceValue) : null;
  }
  
  extractDollarValues(otherLine, otherSummary);
  extractPercentage(otherLine, otherSummary);
}

/**
 * Process Total lines specifically - treating values as text
 */
function processTotalLine(lines: string[], accountSummaries: AccountSummary[]): void {
  const totalLines = lines.filter(line => {
    const words = line.split(/\s+/).map(word => word.trim().toLowerCase());
    // Make sure it's "Total" as a standalone word, not part of another phrase
    return words.includes('total') && !line.toLowerCase().includes('total accounts');
  });
  
  if (totalLines.length === 0) {
    console.log("No Total line found");
    return;
  }

  const totalLine = totalLines[0];
  console.log("Found Total line:", totalLine);
  
  const totalSummary = accountSummaries.find(s => s.accountType === 'Total');
  if (!totalSummary) return;
  
  const pattern = /total\s+(\S+)\s+(\S+)/i;
  const match = totalLine.match(pattern);
  
  if (match) {
    const openValue = match[1];
    totalSummary.open = isNumeric(openValue) ? parseInt(openValue) : null;
    
    const withBalanceValue = match[2];
    totalSummary.withBalance = isNumeric(withBalanceValue) ? parseInt(withBalanceValue) : null;
  }
  
  extractDollarValues(totalLine, totalSummary);
  extractPercentage(totalLine, totalSummary);
}

/**
 * Helper function to extract dollar values from a line
 */
function extractDollarValues(line: string, summary: AccountSummary): void {
  // Look for dollar values in the specific line
  // This regex captures both positive ($X,XXX) and negative (-$X,XXX) dollar amounts
  const dollarPattern = /(-?\$[0-9,.]+|\$-[0-9,.]+)/g;
  const dollarMatches = [];
  
  let match;
  while ((match = dollarPattern.exec(line)) !== null) {
    dollarMatches.push(match[1]);
  }
  
  // Assign values only if they exist
  if (dollarMatches.length >= 1) summary.totalBalance = dollarMatches[0];
  if (dollarMatches.length >= 2) summary.available = dollarMatches[1];
  if (dollarMatches.length >= 3) summary.creditLimit = dollarMatches[2];
  if (dollarMatches.length >= 4) summary.payment = dollarMatches[3];
}

/**
 * Helper function to extract percentage values from a line
 */
function extractPercentage(line: string, summary: AccountSummary): void {
  const percentPattern = /(\d+\.?\d*)\s*%/;
  const percentMatch = line.match(percentPattern);
  
  if (percentMatch) {
    summary.debtToCredit = `${percentMatch[0].trim()}`;
  }
}

/**
 * Helper function to check if a value is numeric
 */
function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}
