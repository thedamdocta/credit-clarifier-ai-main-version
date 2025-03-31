
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
    
    // Process each account type independently to avoid cross-contamination
    extractAccountTypeData('Revolving', tableLines, accountSummaries[0]);
    extractAccountTypeData('Mortgage', tableLines, accountSummaries[1]);
    extractAccountTypeData('Installment', tableLines, accountSummaries[2]);
    extractAccountTypeData('Other', tableLines, accountSummaries[3]);
    extractAccountTypeData('Total', tableLines, accountSummaries[4]);
    
    console.log("Final extracted account summaries:", accountSummaries);
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

// Improved function to extract data for a specific account type
function extractAccountTypeData(accountType: string, tableLines: string[], summary: AccountSummary): void {
  // Look for lines that specifically contain just this account type
  const accountLines = tableLines.filter(line => {
    // Exact match with word boundaries to avoid partial matches
    const exactMatch = new RegExp(`\\b${accountType}\\b`, 'i');
    return exactMatch.test(line);
  });
  
  if (accountLines.length === 0) {
    console.log(`No line found for account type: ${accountType}`);
    return;
  }
  
  console.log(`Found ${accountLines.length} lines for ${accountType}`);
  
  // Use the first line that matches this account type
  const accountLine = accountLines[0];
  console.log(`Processing line for ${accountType}:`, accountLine);
  
  // Find the position where the account type appears
  const typeIndex = accountLine.indexOf(accountType);
  if (typeIndex < 0) return;
  
  // Get data after the account type name
  const dataAfterType = accountLine.substring(typeIndex + accountType.length);
  
  // Extract numeric values (Open, With Balance) 
  const numericMatches = dataAfterType.match(/\b\d+\b/g);
  if (numericMatches && numericMatches.length >= 1) {
    summary.open = parseInt(numericMatches[0]);
    if (numericMatches.length >= 2) {
      summary.withBalance = parseInt(numericMatches[1]);
    }
  }
  
  // Extract dollar amounts - both positive and negative
  // Handle both formats: -$XXX and $-XXX
  const dollarValuePattern = /(-?\$[0-9,.]+|\$-[0-9,.]+)/g;
  const dollarMatches = [];
  let match;
  
  while ((match = dollarValuePattern.exec(dataAfterType)) !== null) {
    dollarMatches.push({
      value: match[0],
      position: match.index
    });
  }
  
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
