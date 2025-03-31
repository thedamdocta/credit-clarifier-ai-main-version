
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
    
    // Debug output: show the entire table section
    logTableDebugInfo(tableSection);
    
    // Extract individual rows that specifically relate to each account type
    // Instead of looking for generic patterns, we'll look for exact account type rows
    extractSpecificAccountTypeRows(tableSection, accountSummaries);
    
    console.log("Final extracted account summaries:", accountSummaries);
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

// Helper to extract lines specific to each account type, improving precision
function extractSpecificAccountTypeRows(tableSection: string, accountSummaries: AccountSummary[]) {
  const lines = tableSection.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Process each account type individually
  accountSummaries.forEach((summary) => {
    const accountType = summary.accountType;
    
    // Find the exact line for this account type - with stricter boundaries
    const matchingLines = lines.filter(line => {
      // Check if line starts with the account type or has it at the beginning after whitespace
      const startsWithType = new RegExp(`^${accountType}\\b|^\\s+${accountType}\\b`, 'i');
      return startsWithType.test(line);
    });
    
    if (matchingLines.length > 0) {
      const accountLine = matchingLines[0];
      console.log(`Found specific line for ${accountType}:`, accountLine);
      parsingLogger.logEvent(`Found specific line for ${accountType}`, { line: accountLine });
      
      // Extract only the values that are actually present in this line
      extractRowWithPrecisePositioning(accountLine, summary);
    } else {
      console.log(`No specific row found for account type: ${accountType}`);
      parsingLogger.logEvent(`No row found for ${accountType}`);
    }
  });
}

// Helper to log detailed table debugging information
function logTableDebugInfo(tableSection: string) {
  console.log("=== TABLE SECTION DEBUG INFO ===");
  console.log("Table section length:", tableSection.length);
  
  // Extract and log cleaned lines for inspection
  const lines = tableSection.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  console.log(`Found ${lines.length} non-empty lines in table section`);
  console.log("First 10 lines:", lines.slice(0, 10));
}

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

// Improved extraction with precise positioning to avoid carrying over values
function extractRowWithPrecisePositioning(row: string, summary: AccountSummary) {
  // Find the position where the account type name ends in the row
  const accountType = summary.accountType;
  const typePattern = new RegExp(`\\b${accountType}\\b`, 'i');
  const match = row.match(typePattern);
  
  if (!match || match.index === undefined) {
    console.log(`Could not locate exact position of ${accountType} in row`);
    return;
  }
  
  // Get just the data portion after the account type
  const dataStart = match.index + match[0].length;
  const dataSection = row.substring(dataStart).trim();
  
  console.log(`Precise data section for ${accountType}: "${dataSection}"`);
  
  // Split the data section by whitespace and process each token in order
  const tokens = dataSection.split(/\s+/).filter(token => token.trim().length > 0);
  console.log(`Found ${tokens.length} data tokens for ${accountType}:`, tokens);
  
  // Only set values if tokens are actually present at expected positions
  if (tokens.length >= 1 && /^\d+$/.test(tokens[0])) {
    summary.open = parseInt(tokens[0]);
  }
  
  if (tokens.length >= 2 && /^\d+$/.test(tokens[1])) {
    summary.withBalance = parseInt(tokens[1]);
  }
  
  // Find all dollar value tokens by pattern
  const dollarTokens = tokens.filter(token => /^\$|^-\$/.test(token));
  
  // Assign dollar values only if they exist in the correct order
  if (dollarTokens.length >= 1) {
    summary.totalBalance = dollarTokens[0];
  }
  
  if (dollarTokens.length >= 2) {
    summary.available = dollarTokens[1];
  }
  
  if (dollarTokens.length >= 3) {
    summary.creditLimit = dollarTokens[2];
  }
  
  // Look for percentage values for debt-to-credit ratio
  const percentToken = tokens.find(token => token.endsWith('%'));
  if (percentToken) {
    summary.debtToCredit = percentToken;
  }
  
  // Payment is typically the last dollar amount
  if (dollarTokens.length >= 4) {
    summary.payment = dollarTokens[dollarTokens.length - 1];
  }
  
  console.log(`Extracted precise values for ${accountType}:`, {
    open: summary.open,
    withBalance: summary.withBalance,
    totalBalance: summary.totalBalance,
    available: summary.available,
    creditLimit: summary.creditLimit,
    debtToCredit: summary.debtToCredit,
    payment: summary.payment
  });
  
  parsingLogger.logEvent(`Extracted precise values for ${accountType}`, { 
    values: {
      open: summary.open,
      withBalance: summary.withBalance,
      totalBalance: summary.totalBalance,
      available: summary.available,
      creditLimit: summary.creditLimit,
      debtToCredit: summary.debtToCredit,
      payment: summary.payment
    }
  });
}
