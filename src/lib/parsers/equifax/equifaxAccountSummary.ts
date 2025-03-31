
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
    
    // Log debug info for the table section
    logTableDebugInfo(tableSection);
    
    // Extract individual rows that specifically relate to each account type
    // We'll use an improved approach focusing on single rows per account type
    extractAccountTypeRowsWithImprovedPrecision(tableSection, accountSummaries);
    
    console.log("Final extracted account summaries:", accountSummaries);
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

// Improved helper for extracting more precise account type data
function extractAccountTypeRowsWithImprovedPrecision(tableSection: string, accountSummaries: AccountSummary[]) {
  // First, split the table section into individual lines
  const lines = tableSection.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  console.log("Extracting lines for individual account types with improved precision:");
  
  // Process each account type one at a time to avoid data cross-contamination
  for (const summary of accountSummaries) {
    const accountType = summary.accountType;
    
    // Look for individual lines that contain just this account type
    // Using more precise pattern matching with word boundaries
    const accountTypeLines = lines.filter(line => {
      // Check for exact account type name with word boundaries
      const exactMatch = new RegExp(`\\b${accountType}\\b`, 'i');
      return exactMatch.test(line);
    });
    
    if (accountTypeLines.length > 0) {
      // Use the first line that matches this account type
      const accountLine = accountTypeLines[0];
      console.log(`Found line for ${accountType}:`, accountLine);
      
      // Extract data from this line only, using more precise positioning
      extractDataForSingleAccountType(accountLine, summary);
    } else {
      console.log(`No line found for account type: ${accountType}`);
    }
  }
}

// Extract data from a single line containing account type information
function extractDataForSingleAccountType(line: string, summary: AccountSummary) {
  try {
    // Find the exact position of the account type in the line
    const accountTypePattern = new RegExp(`\\b${summary.accountType}\\b`, 'i');
    const match = line.match(accountTypePattern);
    
    if (!match || match.index === undefined) {
      console.log(`Could not locate precise position for ${summary.accountType}`);
      return;
    }
    
    // Get the text after the account type
    const dataAfterType = line.substring(match.index + match[0].length).trim();
    console.log(`Data after ${summary.accountType}: "${dataAfterType}"`);
    
    // Split the data into tokens by whitespace for more precise extraction
    const tokens = dataAfterType.split(/\s+/).filter(t => t.trim().length > 0);
    
    if (tokens.length === 0) {
      console.log(`No data tokens found for ${summary.accountType}`);
      return;
    }
    
    console.log(`Found ${tokens.length} tokens for ${summary.accountType}:`, tokens);
    
    // Extract specific data points based on token position and patterns

    // Look for numeric values that would represent "Open" and "With Balance"
    let tokenIndex = 0;
    
    // Try to find the "Open" value (first numeric token)
    while (tokenIndex < tokens.length) {
      if (/^\d+$/.test(tokens[tokenIndex])) {
        summary.open = parseInt(tokens[tokenIndex]);
        tokenIndex++;
        break;
      }
      tokenIndex++;
    }
    
    // Try to find the "With Balance" value (second numeric token)
    while (tokenIndex < tokens.length) {
      if (/^\d+$/.test(tokens[tokenIndex])) {
        summary.withBalance = parseInt(tokens[tokenIndex]);
        tokenIndex++;
        break;
      }
      tokenIndex++;
    }
    
    // Now look for dollar values using separate pattern matching
    const dollarMatches = [];
    const dollarValuePattern = /(-?\$[0-9,.]+|\$-[0-9,.]+)/g;
    let dollarMatch;
    
    while ((dollarMatch = dollarValuePattern.exec(line)) !== null) {
      dollarMatches.push({
        value: dollarMatch[0],
        position: dollarMatch.index
      });
    }
    
    // Sort dollar matches by position to maintain correct order
    dollarMatches.sort((a, b) => a.position - b.position);
    
    // Assign dollar values in their expected order
    if (dollarMatches.length >= 1) {
      summary.totalBalance = dollarMatches[0].value;
    }
    
    if (dollarMatches.length >= 2) {
      summary.available = dollarMatches[1].value;
    }
    
    if (dollarMatches.length >= 3) {
      summary.creditLimit = dollarMatches[2].value;
    }
    
    if (dollarMatches.length >= 4) {
      summary.payment = dollarMatches[3].value;
    }
    
    // Extract debt-to-credit percentage
    const percentMatch = line.match(/(\d+(?:\.\d+)?\s*%)/);
    if (percentMatch) {
      summary.debtToCredit = percentMatch[0].trim();
    }
    
    console.log(`Extracted data for ${summary.accountType}:`, {
      open: summary.open,
      withBalance: summary.withBalance,
      totalBalance: summary.totalBalance,
      available: summary.available,
      creditLimit: summary.creditLimit,
      debtToCredit: summary.debtToCredit,
      payment: summary.payment
    });
    
    parsingLogger.logEvent(`Extracted data for ${summary.accountType}`, { 
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
  } catch (error) {
    console.error(`Error extracting data for ${summary.accountType}:`, error);
  }
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
  
  // Look specifically for lines containing account types
  const accountTypeLines = lines.filter(line => 
    /\b(Revolving|Mortgage|Installment|Other|Total)\b/i.test(line)
  );
  
  console.log("Lines containing account types:");
  accountTypeLines.forEach(line => console.log(line));
}
