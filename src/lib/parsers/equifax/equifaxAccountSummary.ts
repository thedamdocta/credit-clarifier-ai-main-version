
import { AccountSummary } from "../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";
import { formatAccountValue } from "@/utils/formatters/accountValueFormatters";

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
    // First find the table in the text
    const tableSection = extractTableSection(text);
    if (!tableSection) {
      console.log("No account summary table found in the text");
      parsingLogger.logEvent("No account summary table found in the text");
      return accountSummaries;
    }
    
    // Split the table into lines and extract each account type
    const lines = tableSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Extract each account type from its own line
    extractAccountLine(lines, 'Revolving', accountSummaries);
    extractAccountLine(lines, 'Mortgage', accountSummaries);
    extractAccountLine(lines, 'Installment', accountSummaries);
    extractAccountLine(lines, 'Other', accountSummaries);
    extractAccountLine(lines, 'Total', accountSummaries);
    
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
 * Extract the table section from the document text
 */
function extractTableSection(text: string): string | null {
  // Look for the account type header row
  const headerPattern = /account\s+type\s+open\s+with\s+balance\s+total\s+balance\s+available\s+credit\s+limit\s+debt-to-credit\s+payment/i;
  const headerMatch = text.match(headerPattern);
  
  if (!headerMatch) {
    return null;
  }
  
  // Get the text from the header to the end of the table
  const headerIndex = headerMatch.index || 0;
  const tableEndPattern = /(?:other items|summary of|consumer statement|public records|end of report)/i;
  const tableEndMatch = text.slice(headerIndex).match(tableEndPattern);
  
  if (tableEndMatch) {
    return text.slice(headerIndex, headerIndex + tableEndMatch.index);
  } else {
    // If we can't find a clear end, just take a reasonable chunk
    return text.slice(headerIndex, headerIndex + 2000); 
  }
}

/**
 * Extract data for a specific account type from the table lines
 */
function extractAccountLine(lines: string[], accountType: string, accountSummaries: AccountSummary[]): void {
  // Find the line that contains this account type as a whole word
  const accountLine = lines.find(line => {
    const lowercaseLine = line.toLowerCase();
    const lowercaseAccountType = accountType.toLowerCase();
    // Make sure it's a whole word match (preceded by space, start of line, or followed by space/end of line)
    return (lowercaseLine.includes(` ${lowercaseAccountType} `) || 
            lowercaseLine.startsWith(`${lowercaseAccountType} `) || 
            lowercaseLine.includes(` ${lowercaseAccountType}$`) ||
            lowercaseLine === lowercaseAccountType);
  });
  
  if (!accountLine) {
    console.log(`No line found for account type: ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Split the line by whitespace
  const tokens = accountLine.split(/\s+/);
  
  // Find the index of the account type in the tokens
  const accountTypeIndex = tokens.findIndex(token => 
    token.toLowerCase() === accountType.toLowerCase()
  );
  
  if (accountTypeIndex === -1) {
    console.log(`Could not locate ${accountType} in the tokens`);
    return;
  }
  
  // Extract values that appear immediately after the account type name
  // These are typically the "Open" and "With Balance" columns
  if (tokens.length > accountTypeIndex + 1 && isNumericString(tokens[accountTypeIndex + 1])) {
    // Store as string, not number
    accountSummary.open = tokens[accountTypeIndex + 1];
  }
  
  if (tokens.length > accountTypeIndex + 2 && isNumericString(tokens[accountTypeIndex + 2])) {
    // Store as string, not number
    accountSummary.withBalance = tokens[accountTypeIndex + 2];
  }
  
  // Look for dollar amounts separately - they have $ prefixes
  const dollarValues = extractDollarValues(accountLine);
  if (dollarValues.length >= 1) accountSummary.totalBalance = dollarValues[0];
  if (dollarValues.length >= 2) accountSummary.available = dollarValues[1];
  if (dollarValues.length >= 3) accountSummary.creditLimit = dollarValues[2];
  if (dollarValues.length >= 4) accountSummary.payment = dollarValues[3];
  
  // Extract percentage for debt-to-credit
  const percentageValue = extractPercentage(accountLine);
  if (percentageValue) {
    accountSummary.debtToCredit = percentageValue;
  }
}

/**
 * Check if a string represents a numeric value
 */
function isNumericString(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/**
 * Extract dollar values from a text line
 */
function extractDollarValues(line: string): string[] {
  // Match both positive ($XXX) and negative (-$XXX) dollar amounts
  const dollarPattern = /(-?\$[\d,.]+|\$-[\d,.]+)/g;
  const dollarValues: string[] = [];
  
  // Find all dollar value matches in the line
  let match;
  while ((match = dollarPattern.exec(line)) !== null) {
    dollarValues.push(match[0]);
  }
  
  return dollarValues;
}

/**
 * Extract percentage value from a text line
 */
function extractPercentage(line: string): string | null {
  const percentPattern = /([\d.]+%)/;
  const percentMatch = line.match(percentPattern);
  
  if (percentMatch && percentMatch[1]) {
    return percentMatch[1];
  }
  
  return null;
}
