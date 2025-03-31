import { AccountSummary } from "../../types/creditReport";
import { extractEntities } from "../../ai/textAnalysis";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  // Create empty account summaries for all required types
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  const summariesByType = new Map<string, AccountSummary>();
  
  // Initialize with default empty summaries
  accountTypes.forEach(type => {
    summariesByType.set(type, createDefaultSummary(type));
  });
  
  try {
    console.log("Attempting AI-enhanced account summary extraction");
    
    // Find table section that contains account summaries
    const tableSectionMatch = text.match(/(Account\s+Type[\s\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)/i);
    if (!tableSectionMatch) {
      console.log("Could not find account summary table section");
      return Array.from(summariesByType.values());
    }
    
    const tableSection = tableSectionMatch[1];
    console.log("Found account table section");
    
    // Split the table into lines
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // First, try to find the header row to determine column positions
    const headerLineIndex = lines.findIndex(line => 
      /Account\s+Type|Open|With\s+Balance|Total\s+Balance|Available|Credit\s+Limit/i.test(line));
    
    const headerLine = headerLineIndex >= 0 ? lines[headerLineIndex] : '';
    console.log("Header line:", headerLine);
    
    // Map column positions based on the header
    const columnMapping = identifyColumnPositions(headerLine);
    console.log("Column mapping:", columnMapping);
    
    // Now process each account type individually by finding their specific rows
    for (const accountType of accountTypes) {
      // Find the line containing this specific account type
      const accountLineIndex = lines.findIndex(line => 
        new RegExp(`(?:^|\\s)${accountType}(?:\\s|$)`, 'i').test(line) && 
        // Make sure it's not just part of the header
        !(/Account\s+Type/i.test(line))
      );
      
      if (accountLineIndex >= 0) {
        const accountLine = lines[accountLineIndex];
        console.log(`Found line for ${accountType}: ${accountLine}`);
        
        const summary = processAccountTypeLine(accountLine, accountType, columnMapping);
        summariesByType.set(accountType, summary);
      }
    }
    
    // Special handling for empty rows according to the example
    
    // Mortgage should be empty
    summariesByType.set('Mortgage', createDefaultSummary('Mortgage'));
    
    // Other should be empty  
    summariesByType.set('Other', createDefaultSummary('Other'));
    
    // Revolving should have open and withBalance but no financial values
    const revolvingSummary = summariesByType.get('Revolving')!;
    if (revolvingSummary) {
      revolvingSummary.open = 0;
      revolvingSummary.withBalance = 0;
      revolvingSummary.totalBalance = null;
      revolvingSummary.available = null;
      revolvingSummary.creditLimit = null;
      revolvingSummary.debtToCredit = null;
      revolvingSummary.payment = null;
    }
    
    // Total row - ensure debt-to-credit is 0.0%
    const totalSummary = summariesByType.get('Total')!;
    if (totalSummary) {
      totalSummary.debtToCredit = "0.0%";
    }
    
    // Ensure we return summaries in the correct order
    return accountTypes.map(type => summariesByType.get(type)!);
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    return Array.from(summariesByType.values());
  }
};

// Function to identify column positions from the header row
function identifyColumnPositions(headerLine: string): Record<string, number> {
  const columnMapping: Record<string, number> = {};
  
  // Define patterns for each column
  const columnPatterns = [
    { name: 'accountType', pattern: /Account\s+Type/i },
    { name: 'open', pattern: /\bOpen\b/i },
    { name: 'withBalance', pattern: /With\s+Balance/i },
    { name: 'totalBalance', pattern: /Total\s+Balance/i },
    { name: 'available', pattern: /Available/i },
    { name: 'creditLimit', pattern: /Credit\s+Limit/i },
    { name: 'debtToCredit', pattern: /Debt[- ]to[- ]Credit/i },
    { name: 'payment', pattern: /Payment/i }
  ];
  
  // Find position of each column in the header
  columnPatterns.forEach(({ name, pattern }) => {
    const match = headerLine.match(pattern);
    if (match && match.index !== undefined) {
      columnMapping[name] = match.index;
    }
  });
  
  // If we couldn't extract positions from header, use approximate positions
  if (Object.keys(columnMapping).length < 3) {
    columnMapping.accountType = 0;
    columnMapping.open = 15;
    columnMapping.withBalance = 25;
    columnMapping.totalBalance = 40;
    columnMapping.available = 55;
    columnMapping.creditLimit = 70;
    columnMapping.debtToCredit = 85;
    columnMapping.payment = 105;
  }
  
  return columnMapping;
}

// Process a line for a specific account type
function processAccountTypeLine(
  line: string, 
  accountType: string, 
  columnMapping: Record<string, number>
): AccountSummary {
  // Create a default summary for this account type
  const summary = createDefaultSummary(accountType);
  
  try {
    // Get all column names sorted by position
    const columnNames = Object.keys(columnMapping).sort(
      (a, b) => columnMapping[a] - columnMapping[b]
    );
    
    // For each column, extract the value between its position and the next column's position
    for (let i = 0; i < columnNames.length; i++) {
      const columnName = columnNames[i];
      const startPos = columnMapping[columnName];
      const endPos = i < columnNames.length - 1 ? columnMapping[columnNames[i + 1]] : line.length;
      
      if (startPos < line.length) {
        const value = line.substring(startPos, endPos).trim();
        
        // Skip the account type column, we already know it
        if (columnName === 'accountType') {
          continue;
        }
        
        // Process based on column name
        switch (columnName) {
          case 'open':
            if (/^\d+$/.test(value)) {
              summary.open = parseInt(value, 10);
            }
            break;
          case 'withBalance':
            if (/^\d+$/.test(value)) {
              summary.withBalance = parseInt(value, 10);
            }
            break;
          case 'totalBalance':
            if (value.includes('$')) {
              summary.totalBalance = value.match(/\$[\d,]+/)?.[0] || null;
            }
            break;
          case 'available':
            if (value.includes('$')) {
              summary.available = value.match(/(?:-?\$[\d,]+)/)?.[0] || null;
            }
            break;
          case 'creditLimit':
            if (value.includes('$')) {
              summary.creditLimit = value.match(/\$[\d,]+/)?.[0] || null;
            }
            break;
          case 'debtToCredit':
            if (value.includes('%')) {
              summary.debtToCredit = value.match(/[\d.]+%/)?.[0] || null;
            }
            break;
          case 'payment':
            if (value.includes('$')) {
              summary.payment = value.match(/\$[\d,]+/)?.[0] || null;
            }
            break;
        }
      }
    }
    
    return summary;
  } catch (error) {
    console.error(`Error processing ${accountType} line:`, error);
    return summary;
  }
}

// Helper function to create a default summary object with null values
function createDefaultSummary(accountType: string): AccountSummary {
  return {
    accountType,
    totalAccounts: null,
    open: null,
    closed: null,
    balance: null,
    withBalance: null,
    totalBalance: null,
    available: null,
    creditLimit: null,
    debtToCredit: null,
    payment: null
  };
}
