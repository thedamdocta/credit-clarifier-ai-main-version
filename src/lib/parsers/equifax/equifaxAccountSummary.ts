import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction for 8x6 table structure");
  
  // Define the empty account summaries structure (now for 6 rows - 5 account types + header)
  const accountSummaries: AccountSummary[] = [
    { accountType: 'Revolving', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Mortgage', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Installment', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Collection', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
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
    const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Collection', 'Other', 'Total'];
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
      } else {
        console.log(`No row found for account type: ${accountType}`);
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
  // Look for sections that contain account summary tables - additional pattern for Collection accounts
  const possibleMarkers = [
    /Account\s+Type\s+Open\s+With\s+Balance\s+Total\s+Balance\s+Available\s+Credit\s+Limit/i,
    /Your\s+credit\s+report\s+includes\s+information\s+about\s+activity\s+on\s+your\s+credit\s+accounts/i,
    /Account\s+Type[\s\S]+?(?:Revolving|Mortgage|Installment|Collection|Other|Total)/i
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
  
  // If we still don't have a match, try a more generic approach with Collection added
  if (!tableSection) {
    const genericMatch = text.match(/((?:Revolving|Mortgage|Installment|Collection|Other|Total)[\s\S]+?(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report))/i);
    if (genericMatch && genericMatch[1]) {
      tableSection = genericMatch[1];
      console.log("Found table section using generic approach");
    }
  }
  
  return tableSection;
}

function findHeaderRow(tableSection: string): string | null {
  // Try to find the header row to understand column structure - added "Collection" to patterns
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
  
  // Improved handling: First identify all possible data points in the row
  const tokenMatches = [
    ...dataSection.matchAll(/(-?\$?[\d,]+(?:\.\d+)?)|(\d+%)|(\d+)|(N\/A)/g)
  ];
  
  console.log(`Found ${tokenMatches.length} potential data tokens in row`);
  
  if (tokenMatches.length === 0) {
    console.log(`No data tokens found in row for ${accountType}`);
    return;
  }
  
  // Map values based on likely column position
  // Expected columns: totalAccounts, open, closed, balance/withBalance, totalBalance, available, creditLimit, debtToCredit, payment
  
  let columnMap: {[key: string]: any} = {};
  let columnIndex = 0;
  
  // Process each token
  tokenMatches.forEach(match => {
    const value = match[0];
    
    // Skip empty matches
    if (!value) return;
    
    // Handle different value types
    if (/^\d+$/.test(value)) {
      // Integer values likely represent counts (totalAccounts, open, closed, withBalance)
      const intValue = parseInt(value);
      if (columnIndex === 0) {
        columnMap.totalAccounts = intValue;
      } else if (columnIndex === 1) {
        columnMap.open = intValue;
      } else if (columnIndex === 2) {
        columnMap.closed = intValue;
      } else if (columnIndex === 3) {
        columnMap.withBalance = intValue;
      }
    } else if (/^-?\$[\d,]+(?:\.\d+)?$/.test(value) || /^-?\$?\d[\d,.]+$/.test(value)) {
      // Dollar values can be balance, totalBalance, available, creditLimit, payment
      if (columnIndex === 3 || columnIndex === 4) {
        columnMap.totalBalance = value;
      } else if (columnIndex === 5) {
        columnMap.available = value;
      } else if (columnIndex === 6) {
        columnMap.creditLimit = value;
      } else if (columnIndex === 8 || columnIndex === 7) {
        // Payment might be in position 7 or 8 depending on if debt-to-credit is present
        columnMap.payment = value;
      }
    } else if (/^\d+%$/.test(value)) {
      // Percentage is definitely debt-to-credit
      columnMap.debtToCredit = value;
    } else if (value === 'N/A') {
      // N/A values keep the column position but don't assign any value
      // This ensures correct column alignment
    }
    
    columnIndex++;
  });
  
  // Assign identified values to the summary object
  Object.keys(columnMap).forEach(key => {
    if (columnMap[key] !== undefined && columnMap[key] !== null) {
      (summary as any)[key] = columnMap[key];
    }
  });
  
  console.log(`Extracted values for ${accountType}:`, {
    totalAccounts: summary.totalAccounts,
    open: summary.open,
    closed: summary.closed,
    withBalance: summary.withBalance,
    totalBalance: summary.totalBalance,
    available: summary.available,
    creditLimit: summary.creditLimit,
    debtToCredit: summary.debtToCredit,
    payment: summary.payment
  });
}
