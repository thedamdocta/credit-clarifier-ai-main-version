
import { AccountSummary } from "../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction for table structure");
  parsingLogger.logEvent("Starting equifax account summary extraction");
  
  // Define the empty account summaries structure (now for 5 rows - 4 account types + header)
  const accountSummaries: AccountSummary[] = [
    { accountType: 'Revolving', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Mortgage', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Installment', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Other', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Total', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null }
  ];

  try {
    // Extract the table section with account summaries
    const tableSection = extractTableSection(text);
    if (!tableSection) {
      console.log("Could not find account summary table section");
      parsingLogger.logEvent("No account summary table section found");
      return accountSummaries;
    }
    
    // Split the table into individual lines for better processing
    const tableLines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    console.log("Processing table with", tableLines.length, "lines");
    
    // Process each account type with strict isolation
    for (const accountType of ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total']) {
      // Find index of this account type in our result array
      const summaryIndex = accountSummaries.findIndex(s => s.accountType === accountType);
      if (summaryIndex >= 0) {
        // Find a line that contains ONLY this account type
        const specificLine = findExactLineForAccountType(tableLines, accountType);
        
        if (specificLine) {
          console.log(`Processing line for ${accountType}:`, specificLine);
          // Extract data with strict null preservation
          extractDataFromLine(specificLine, accountSummaries[summaryIndex]);
        } else {
          console.log(`No unique line found for ${accountType}, keeping all values null`);
        }
      }
    }
    
    console.log("Final extracted account summaries:", accountSummaries);
    parsingLogger.logEvent("Completed account summary extraction", { count: accountSummaries.length });
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

/**
 * Find a line that contains EXACTLY this account type and nothing else
 */
function findExactLineForAccountType(tableLines: string[], accountType: string): string | null {
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // First try: find lines containing ONLY this account type
  for (const line of tableLines) {
    if (line.includes(accountType)) {
      // Check if this line contains any other account types
      const containsOtherTypes = accountTypes
        .filter(type => type !== accountType)
        .some(type => line.includes(type));
      
      if (!containsOtherTypes) {
        return line; // Found an exact match
      }
    }
  }
  
  // No exact match found, try for broader matches but only if it's clear
  for (const line of tableLines) {
    // Check if line starts with the account type (more likely to be a dedicated line)
    if (line.trim().startsWith(accountType)) {
      return line;
    }
  }
  
  // Still no match, so return null - we won't use fallbacks
  return null;
}

/**
 * Extract data from a line for a specific account type, maintaining null values if not found
 */
function extractDataFromLine(line: string, summary: AccountSummary): void {
  // Get account type to find its position
  const accountType = summary.accountType;
  
  // Find where the account type appears in the line
  const typeIndex = line.indexOf(accountType);
  if (typeIndex < 0) return; // Safety check
  
  // Get the substring after account type
  const dataAfterType = line.substring(typeIndex + accountType.length).trim();
  
  // Clean up the line by removing extra spaces
  const cleanLine = dataAfterType.replace(/\s+/g, ' ');
  
  // Split into tokens for easier processing
  const tokens = cleanLine.split(' ');
  
  // Extract first two numeric values for 'open' and 'withBalance'
  let numericCount = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^\d+$/.test(token)) {
      if (numericCount === 0) {
        summary.open = parseInt(token);
        numericCount++;
      } else if (numericCount === 1) {
        summary.withBalance = parseInt(token);
        break;
      }
    }
  }
  
  // Extract dollar values (both positive and negative)
  const dollarPattern = /(-?\$[\d,]+|\$-[\d,]+)/g;
  const dollarMatches = [];
  let match;
  
  while ((match = dollarPattern.exec(line)) !== null) {
    dollarMatches.push(match[0]);
  }
  
  // Assign dollar values in the expected order (if found)
  if (dollarMatches.length >= 1) summary.totalBalance = dollarMatches[0];
  if (dollarMatches.length >= 2) summary.available = dollarMatches[1];
  if (dollarMatches.length >= 3) summary.creditLimit = dollarMatches[2];
  if (dollarMatches.length >= 4) summary.payment = dollarMatches[3];
  
  // Extract percentage (Debt-to-Credit)
  const percentMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    summary.debtToCredit = `${percentMatch[0].trim()}`;
  }
  
  console.log(`Extracted data for ${accountType}:`, {
    open: summary.open,
    withBalance: summary.withBalance,
    totalBalance: summary.totalBalance,
    available: summary.available,
    creditLimit: summary.creditLimit,
    debtToCredit: summary.debtToCredit,
    payment: summary.payment
  });
}

// Help extract the relevant table section from the text
function extractTableSection(text: string): string | null {
  // Look for sections that contain account summary tables
  const possibleMarkers = [
    /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit/i,
    /Your\s+credit\s+report\s+includes\s+information\s+about\s+activity\s+on\s+your\s+credit\s+accounts/i,
    /Account\s+Type[\s\S]+?(?:Revolving|Mortgage|Installment|Other|Total)/i
  ];
  
  let tableSection = null;
  
  for (const marker of possibleMarkers) {
    // Find a section that starts with our marker and continues until another major section
    const sectionMatch = text.match(new RegExp(`(${marker.source}[\\s\\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)`, 'i'));
    if (sectionMatch && sectionMatch[1]) {
      tableSection = sectionMatch[1];
      console.log(`Found table section using marker: ${marker.source}`);
      parsingLogger.logEvent("Found table section", { marker: marker.source });
      break;
    }
  }
  
  return tableSection;
}
