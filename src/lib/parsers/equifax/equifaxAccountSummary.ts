
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
    
    // Find header row to determine column structure
    const headerRow = findHeaderRow(tableSection);
    if (headerRow) {
      console.log("Found header row:", headerRow);
      parsingLogger.logEvent("Found header row", { row: headerRow });
    } else {
      console.log("No header row found, using default column structure");
      parsingLogger.logEvent("No header row found");
    }
    
    // Split the table into individual lines for better processing
    const tableLines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    console.log("Processing table with", tableLines.length, "lines");
    console.log("Processing account summaries individually for each account type");
    
    // Get the actual table layout to determine possible formats
    const tableFormat = determineTableFormat(tableLines);
    
    // Process each account type independently on different lines
    for (const accountType of ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total']) {
      // Find index of this account type in our result array
      const summaryIndex = accountSummaries.findIndex(s => s.accountType === accountType);
      if (summaryIndex >= 0) {
        // Look for a line that specifically contains this account type
        const specificLine = findSpecificLineForAccountType(tableLines, accountType);
        if (specificLine) {
          console.log(`Processing specific line for ${accountType}:`, specificLine);
          extractDataFromLine(specificLine, accountSummaries[summaryIndex], accountType);
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
 * Find a line specifically for this account type, avoiding lines that contain multiple account types
 */
function findSpecificLineForAccountType(tableLines: string[], accountType: string): string | null {
  // First priority: lines that contain this account type and don't contain other account types
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  const otherAccountTypes = accountTypes.filter(type => type !== accountType);
  
  // Look for lines that contain just this account type
  for (const line of tableLines) {
    // Check if this line contains our target account type
    const containsTargetType = new RegExp(`\\b${accountType}\\b`, 'i').test(line);
    if (!containsTargetType) continue;
    
    // Check if line contains any other account types - if not, it's a perfect match
    const containsOtherTypes = otherAccountTypes.some(type => 
      new RegExp(`\\b${type}\\b`, 'i').test(line)
    );
    
    if (!containsOtherTypes) {
      return line; // Found a line with only our target account type
    }
  }
  
  // Second priority: lines that contain this account type, even if they contain other types too
  // This is a fallback if we can't find a clean line
  for (const line of tableLines) {
    if (new RegExp(`\\b${accountType}\\b`, 'i').test(line)) {
      return line;
    }
  }
  
  return null;
}

/**
 * Extract data from a line for a specific account type
 */
function extractDataFromLine(line: string, summary: AccountSummary, accountType: string): void {
  // Find where the account type appears in the line
  const typeMatch = line.match(new RegExp(`\\b${accountType}\\b`, 'i'));
  if (!typeMatch) return;
  
  const startPos = typeMatch.index! + accountType.length;
  const dataAfterType = line.substring(startPos);
  
  // Extract numeric values for Open, With Balance
  const numericPattern = /\b(\d+)\b/g;
  const numericMatches = [];
  let match;
  
  while ((match = numericPattern.exec(dataAfterType)) !== null) {
    numericMatches.push({
      value: parseInt(match[1]),
      position: match.index
    });
  }
  
  // Assign the first two numeric values to open and withBalance if found
  if (numericMatches.length >= 1) summary.open = numericMatches[0].value;
  if (numericMatches.length >= 2) summary.withBalance = numericMatches[1].value;
  
  // Extract dollar amounts (both positive and negative)
  const dollarPattern = /(-?\$[\d,]+|\$-[\d,]+)/g;
  const dollarMatches = [];
  
  while ((match = dollarPattern.exec(dataAfterType)) !== null) {
    dollarMatches.push({
      value: match[0],
      position: match.index
    });
  }
  
  // Assign dollar values based on position in the line
  if (dollarMatches.length >= 1) summary.totalBalance = dollarMatches[0].value;
  if (dollarMatches.length >= 2) summary.available = dollarMatches[1].value;
  if (dollarMatches.length >= 3) summary.creditLimit = dollarMatches[2].value;
  if (dollarMatches.length >= 4) summary.payment = dollarMatches[3].value;
  
  // Extract percentage (Debt-to-Credit)
  const percentMatch = dataAfterType.match(/(\d+(?:\.\d+)?)\s*%/);
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

/**
 * Determine the table format based on the lines
 */
function determineTableFormat(tableLines: string[]): string {
  // Look for header patterns to determine table format
  for (const line of tableLines) {
    if (line.includes('Account Type') && line.includes('Open') && line.includes('Balance')) {
      if (line.includes('Available') && line.includes('Credit Limit')) {
        return 'standard';
      } else if (line.includes('Total Accounts')) {
        return 'summary';
      }
    }
  }
  
  return 'unknown';
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
  
  // If we still don't have a match, try a more generic approach
  if (!tableSection) {
    // Look for a section containing all account types
    const genericMatch = text.match(/((?:Revolving|Mortgage|Installment|Other|Total)[\s\S]+?(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report))/i);
    if (genericMatch && genericMatch[1]) {
      tableSection = genericMatch[1];
      console.log("Found table section using generic approach");
      parsingLogger.logEvent("Found table section using generic approach");
    }
  }
  
  return tableSection;
}

function findHeaderRow(tableSection: string): string | null {
  // Try to find the header row to understand column structure
  const headerPatterns = [
    /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit\s+Debt-to-Credit\s+Payment/i,
    /Account\s+Type\s+Total\s+Accounts\s+Open\s+Closed\s+Balance/i,
    /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available/i
  ];
  
  for (const pattern of headerPatterns) {
    const lines = tableSection.split('\n');
    for (const line of lines) {
      if (pattern.test(line.trim())) {
        return line.trim();
      }
    }
  }
  
  return null;
}
