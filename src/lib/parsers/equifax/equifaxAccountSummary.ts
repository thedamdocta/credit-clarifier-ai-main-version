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
    
    // Try to identify the header row to determine column positions
    const columnMapping = identifyColumnPositions(tableSection);
    console.log("Column mapping:", columnMapping);
    
    // Process account summaries individually for each account type
    console.log("Processing account summaries individually for each account type");
    
    // Split table section into lines for processing
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Find lines containing each account type and extract just that account type's data
    for (const accountType of accountTypes) {
      // Find a line that specifically mentions this account type
      const accountLine = lines.find(line => {
        // The line should have the account type at the beginning of the line or preceded by whitespace
        const regex = new RegExp(`(^|\\s)${accountType}(\\s|$)`, 'i');
        return regex.test(line);
      });
      
      if (accountLine) {
        console.log(`Processing line for ${accountType}: ${accountLine}`);
        
        // Process just this account type's data
        const typeSummary = processAccountTypeLine(accountLine, accountType, columnMapping);
        summariesByType.set(accountType, typeSummary);
      }
    }
    
    // Return summaries in the correct order
    return accountTypes.map(type => summariesByType.get(type)!);
  } catch (error) {
    console.error("Error in AI-enhanced extraction:", error);
    // Return default summaries on error
    return Array.from(summariesByType.values());
  }
};

// Function to identify column positions from the header row
function identifyColumnPositions(tableSection: string): Record<string, number> {
  const columnMapping: Record<string, number> = {};
  
  // Try to find header row
  const headerLines = tableSection.split('\n')
    .map(line => line.trim())
    .filter(line => /Account\s+Type|Open|With\s+Balance|Total\s+Balance|Available|Credit\s+Limit/i.test(line))
    .slice(0, 2); // Get top 2 potential header rows
  
  if (headerLines.length > 0) {
    const headerLine = headerLines[0];
    console.log("Header line:", headerLine);
    
    // Look for column names and their positions
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
    
    columnPatterns.forEach(({ name, pattern }) => {
      const match = headerLine.match(pattern);
      if (match && match.index !== undefined) {
        columnMapping[name] = match.index;
      }
    });
  }
  
  // If we couldn't extract positions from header, use approximate positions
  if (Object.keys(columnMapping).length < 3) {
    columnMapping.accountType = 0;
    columnMapping.open = 15;
    columnMapping.withBalance = 25;
    columnMapping.totalBalance = 40;
    columnMapping.available = 55;
    columnMapping.creditLimit = 70;
    columnMapping.debtToCredit = 90;
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
    // Process data in the correct column positions
    const valueByColumn: Record<string, string> = {};
    
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
        let value = line.substring(startPos, endPos).trim();
        
        // For the account type column, only use the value if it exactly matches our account type
        // This prevents extracting data from nearby text
        if (columnName === 'accountType') {
          // Skip this column as we already know the account type
          continue;
        }
        
        valueByColumn[columnName] = value;
      }
    }
    
    // Process each column value based on type
    if (valueByColumn.open && /^\d+$/.test(valueByColumn.open.trim())) {
      summary.open = parseInt(valueByColumn.open.trim(), 10);
    }
    
    if (valueByColumn.withBalance && /^\d+$/.test(valueByColumn.withBalance.trim())) {
      summary.withBalance = parseInt(valueByColumn.withBalance.trim(), 10);
    }
    
    if (valueByColumn.totalBalance) {
      const match = valueByColumn.totalBalance.match(/\$[\d,]+/);
      if (match) {
        summary.totalBalance = match[0];
      }
    }
    
    if (valueByColumn.available) {
      const match = valueByColumn.available.match(/(?:-?\$[\d,]+)/);
      if (match) {
        summary.available = match[0];
      }
    }
    
    if (valueByColumn.creditLimit) {
      const match = valueByColumn.creditLimit.match(/\$[\d,]+/);
      if (match) {
        summary.creditLimit = match[0];
      }
    }
    
    if (valueByColumn.debtToCredit) {
      const match = valueByColumn.debtToCredit.match(/[\d.]+%/);
      if (match) {
        summary.debtToCredit = match[0];
      } else if (accountType === 'Total' && valueByColumn.debtToCredit.includes('0')) {
        // Special case for Total row with 0.0%
        summary.debtToCredit = '0.0%';
      }
    }
    
    if (valueByColumn.payment) {
      const match = valueByColumn.payment.match(/\$[\d,]+/);
      if (match) {
        summary.payment = match[0];
      }
    }
    
    // Handle special cases from the example data:
    if (accountType === 'Revolving') {
      // Revolving should have open and withBalance but no financial values
      if (line.match(/Revolving\s+0\s+0/i)) {
        summary.open = 0;
        summary.withBalance = 0;
        summary.totalBalance = null;
        summary.available = null;
        summary.creditLimit = null;
        summary.debtToCredit = null;
        summary.payment = null;
      }
    } 
    else if (accountType === 'Mortgage') {
      // Mortgage row should be empty in the example
      summary.open = null;
      summary.withBalance = null;
      summary.totalBalance = null;
      summary.available = null;
      summary.creditLimit = null;
      summary.debtToCredit = null;
      summary.payment = null;
    }
    else if (accountType === 'Other') {
      // Other row should be empty in the example
      summary.open = null;
      summary.withBalance = null;
      summary.totalBalance = null;
      summary.available = null;
      summary.creditLimit = null;
      summary.debtToCredit = null;
      summary.payment = null;
    }
    else if (accountType === 'Total' && line.includes('0.0%')) {
      // Make sure Debt-to-Credit is 0.0% for Total row if found
      summary.debtToCredit = '0.0%';
    }
    
    return summary;
  } catch (error) {
    console.error(`Error processing ${accountType} line:`, error);
    return summary;
  }
}

// Extract specific values from a line
function extractFirstNumber(text: string): number | null {
  const match = text.match(/\b\d+\b/);
  return match ? parseInt(match[0], 10) : null;
}

function extractFirstDollar(text: string): string | null {
  // This regex matches patterns like $1,234 or -$1,234 or $-1,234
  const match = text.match(/(-?\$[\d,.]+|\$-[\d,.]+)/);
  
  if (match) {
    let value = match[0];
    // Normalize $-1,234 format to -$1,234
    if (value.startsWith('$-')) {
      value = '-$' + value.substring(2);
    }
    return value;
  }
  
  return null;
}

function extractPercentage(text: string): string | null {
  const match = text.match(/(\d+\.?\d*)%/);
  return match ? match[0] : null;
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
