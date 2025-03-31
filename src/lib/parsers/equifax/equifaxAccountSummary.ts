
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction with improved handling of empty cells");
  
  // Define the empty account summaries structure
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
      return accountSummaries;
    }
    
    // Find header row to determine column structure
    const headerRow = findHeaderRow(tableSection);
    if (headerRow) {
      console.log("Found header row:", headerRow);
    }
    
    // Get individual rows by finding lines that contain the account types
    const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
    const rows: {[key: string]: string} = {};
    
    // Find complete lines containing each account type
    for (const accountType of accountTypes) {
      const regex = new RegExp(`.*\\b${accountType}\\b.*`, 'i');
      const matches = tableSection.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => regex.test(line));
      
      if (matches.length > 0) {
        // Only use the first match for each account type to avoid duplicates
        rows[accountType] = matches[0];
        console.log(`Found row for ${accountType}: ${matches[0]}`);
      }
    }
    
    // Process each account type row separately, preserving empty cells
    for (const accountType of accountTypes) {
      if (rows[accountType]) {
        const accountIndex = accountSummaries.findIndex(a => a.accountType === accountType);
        if (accountIndex !== -1) {
          // Extract values specifically for this account type, respecting empty cells
          extractValuesFromRow(rows[accountType], accountType, accountSummaries[accountIndex], headerRow);
        }
      }
    }
    
    console.log("Final extracted account summaries:", accountSummaries);
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    return accountSummaries; // Return empty structure on error
  }
};

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
      break;
    }
  }
  
  // If we still don't have a match, try a more generic approach
  if (!tableSection) {
    const genericMatch = text.match(/((?:Revolving|Mortgage|Installment|Other|Total)[\s\S]+?(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report))/i);
    if (genericMatch && genericMatch[1]) {
      tableSection = genericMatch[1];
      console.log("Found table section using generic approach");
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

function extractValuesFromRow(row: string, accountType: string, summary: AccountSummary, headerRow: string | null): void {
  // Find the position of the account type in the row
  const accountTypePos = row.indexOf(accountType);
  if (accountTypePos === -1) return;
  
  // Extract only the data part after the account type
  const dataSection = row.substring(accountTypePos + accountType.length);
  console.log(`Processing data for ${accountType}: "${dataSection}"`);
  
  // Create a structured approach based on token positioning to respect empty cells
  const tokens = dataSection.split(/\s+/).filter(token => token.trim().length > 0);
  
  // Initialize the column trackers
  let currentColumn = 0;
  let currentTokenIndex = 0;
  const columnValues: (string | number | null)[] = [];
  
  // Process tokens into structured columns
  while (currentTokenIndex < tokens.length) {
    const token = tokens[currentTokenIndex];
    
    // Skip tokens that are likely not data values (e.g., words that slipped through)
    if (/^[A-Za-z]+$/.test(token) && !/^\d+%$/.test(token)) {
      currentTokenIndex++;
      continue;
    }
    
    // Handle percentage values (debt-to-credit)
    if (token.includes('%')) {
      columnValues[5] = token; // Assign to appropriate column index
      currentTokenIndex++;
      continue;
    }
    
    // Handle monetary values
    if (token.includes('$') || (currentTokenIndex > 0 && tokens[currentTokenIndex-1] === '-' && tokens[currentTokenIndex].match(/^\d/))) {
      // Handle negative sign as separate token
      let value = token;
      if (currentTokenIndex > 0 && tokens[currentTokenIndex-1] === '-' && !token.startsWith('-') && token.includes('$')) {
        value = '-' + token;
      }
      
      // For monetary values, determine which column it belongs to
      if (columnValues[2] === undefined && isMonetaryValue(value)) {
        // Total Balance column
        columnValues[2] = value;
      } else if (columnValues[3] === undefined && isMonetaryValue(value)) {
        // Available column
        columnValues[3] = value;
      } else if (columnValues[4] === undefined && isMonetaryValue(value)) {
        // Credit Limit column
        columnValues[4] = value;
      } else if (columnValues[6] === undefined && isMonetaryValue(value)) {
        // Payment column
        columnValues[6] = value;
      }
      
      currentTokenIndex++;
      if (tokens[currentTokenIndex-1] === '-') {
        // Skip the negative sign if we just processed it with the value
        currentTokenIndex++;
      }
      continue;
    }
    
    // Handle numeric values (account counts)
    if (/^\d+$/.test(token)) {
      const numVal = parseInt(token);
      
      // Assign to the appropriate column based on position
      if (columnValues[0] === undefined) {
        // Open column
        columnValues[0] = numVal;
      } else if (columnValues[1] === undefined) {
        // With Balance column
        columnValues[1] = numVal;
      } else {
        // Any other numeric column
        columnValues[currentColumn] = numVal;
        currentColumn++;
      }
      
      currentTokenIndex++;
      continue;
    }
    
    // Skip any unrecognized token
    currentTokenIndex++;
  }
  
  // Assign values to the appropriate fields based on position
  if (columnValues[0] !== undefined) summary.open = columnValues[0] as number | null;
  if (columnValues[1] !== undefined) summary.withBalance = columnValues[1] as number | null;
  if (columnValues[2] !== undefined) summary.totalBalance = columnValues[2] as string | null;
  if (columnValues[3] !== undefined) summary.available = columnValues[3] as string | null;
  if (columnValues[4] !== undefined) summary.creditLimit = columnValues[4] as string | null;
  if (columnValues[5] !== undefined) summary.debtToCredit = columnValues[5] as string | null;
  if (columnValues[6] !== undefined) summary.payment = columnValues[6] as string | null;
  
  console.log(`Extracted values for ${accountType}:`, {
    open: summary.open,
    withBalance: summary.withBalance,
    totalBalance: summary.totalBalance,
    available: summary.available,
    creditLimit: summary.creditLimit,
    debtToCredit: summary.debtToCredit,
    payment: summary.payment
  });
}

// Helper function to check if a value is likely a monetary value
function isMonetaryValue(value: string): boolean {
  return value.includes('$') || value.match(/^-?\$?\d{1,3}(,\d{3})*(\.\d{2})?$/) !== null;
}
