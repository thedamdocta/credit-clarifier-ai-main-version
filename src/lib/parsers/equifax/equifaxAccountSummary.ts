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
        parsingLogger.logEvent(`Found row for ${accountType}`, { row: matches[0] });
      } else {
        console.log(`No row found for account type: ${accountType}`);
        parsingLogger.logEvent(`No row found for ${accountType}`);
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
    
    // Try an alternative approach if we don't have much data
    const hasData = accountSummaries.some(summary => 
      summary.open !== null || summary.totalBalance !== null
    );
    
    if (!hasData) {
      console.log("Trying alternative table extraction approach");
      parsingLogger.logEvent("Using alternative extraction approach");
      tryAlternativeTableExtraction(tableSection, accountSummaries);
    }
    
    console.log("Final extracted account summaries:", accountSummaries);
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

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
  
  // Look for specific patterns in the table
  const dollarValues = tableSection.match(/\$[\d,]+(?:\.\d+)?/g) || [];
  console.log(`Found ${dollarValues.length} dollar values:`, dollarValues.slice(0, 5));
  
  // Look for account type mentions
  const accountTypeMatches = ["Revolving", "Mortgage", "Installment", "Other", "Total"].map(type => {
    const regex = new RegExp(`\\b${type}\\b`, 'ig');
    const matches = tableSection.match(regex) || [];
    return { type, count: matches.length };
  });
  
  console.log("Account type mentions:", accountTypeMatches);
  parsingLogger.logEvent("Table section analysis", { 
    lines: lines.length,
    dollarValues: dollarValues.length,
    accountTypeMatches
  });
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

function extractValuesFromRow(row: string, accountType: string, summary: AccountSummary, headerRow: string | null): void {
  // Find the position of the account type in the row
  const accountTypePos = row.indexOf(accountType);
  if (accountTypePos === -1) return;
  
  // Extract only the data part after the account type
  const dataSection = row.substring(accountTypePos + accountType.length);
  console.log(`Processing data for ${accountType}: "${dataSection}"`);
  parsingLogger.logEvent(`Processing data row for ${accountType}`, { data: dataSection });
  
  // Improved handling: First identify all possible data points in the row
  const tokenMatches = [
    ...dataSection.matchAll(/(-?\$?[\d,]+(?:\.\d+)?)|(\d+%)|(\d+)|(N\/A)/g)
  ];
  
  console.log(`Found ${tokenMatches.length} potential data tokens in row`);
  parsingLogger.logEvent(`Data tokens for ${accountType}`, { count: tokenMatches.length, tokens: tokenMatches.map(m => m[0]) });
  
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
  
  parsingLogger.logEvent(`Extracted values for ${accountType}`, { 
    values: {
      totalAccounts: summary.totalAccounts,
      open: summary.open,
      totalBalance: summary.totalBalance,
      available: summary.available,
      creditLimit: summary.creditLimit,
      debtToCredit: summary.debtToCredit
    }
  });
}

// Try an alternative table extraction approach based on line-by-line analysis
function tryAlternativeTableExtraction(tableSection: string, accountSummaries: AccountSummary[]) {
  const lines = tableSection.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // For each account type, try to find a line that contains both the type and numbers
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  for (const accountType of accountTypes) {
    // Find lines that contain this account type
    const relevantLines = lines.filter(line => 
      new RegExp(`\\b${accountType}\\b`, 'i').test(line)
    );
    
    if (relevantLines.length > 0) {
      // Try to extract numeric values from the line
      for (const line of relevantLines) {
        // Find all numbers in the line
        const numbers = line.match(/\d+/g);
        if (numbers && numbers.length >= 2) {
          const summaryIndex = accountSummaries.findIndex(s => s.accountType === accountType);
          if (summaryIndex !== -1) {
            // Assign the first number to "open" if it's not already set
            if (accountSummaries[summaryIndex].open === null) {
              accountSummaries[summaryIndex].open = parseInt(numbers[0]);
            }
            
            // Look for dollar values in the line
            const dollarMatch = line.match(/\$[\d,]+(?:\.\d+)?/);
            if (dollarMatch && accountSummaries[summaryIndex].totalBalance === null) {
              accountSummaries[summaryIndex].totalBalance = dollarMatch[0];
            }
            
            console.log(`Alternative extraction for ${accountType}:`, 
              { line, numbers, summary: accountSummaries[summaryIndex] });
          }
        }
      }
    }
  }
}
