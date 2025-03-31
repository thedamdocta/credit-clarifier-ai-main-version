
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
    
    // First attempt AI-enhanced extraction for better pattern recognition
    const entities = await extractEntities(text);
    
    // Look for table section that contains account summaries
    const tableSectionMatch = text.match(/(Account\s+Type[\s\S]+?)(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report)/i);
    if (!tableSectionMatch) {
      console.log("Could not find account summary table section");
      return Array.from(summariesByType.values());
    }
    
    const tableSection = tableSectionMatch[1];
    console.log("Found account table section");
    
    // Try to identify the header row to determine column positions
    const headerPattern = /Account\s+Type(?:\s+(Open|Total\s+Accounts?))?\s+(?:(With\s+Balance))?\s+(?:(Total\s+Balance))?\s+(?:(Available))?\s+(?:(Credit\s+Limit))?\s+(?:(Debt[- ]to[- ]Credit))?\s+(?:(Payment))?/i;
    const headerMatch = tableSection.match(headerPattern);
    
    // Identify column positions from header if possible
    const columnMapping = identifyColumnPositions(tableSection);
    console.log("Column mapping:", columnMapping);
    
    // Split table section into lines for processing
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Process each line to identify account type data
    let processedTypes = new Set<string>();
    
    // Find the line that has "Account Type" in it to identify the header row
    const headerLineIndex = lines.findIndex(line => /Account\s+Type/i.test(line));
    if (headerLineIndex !== -1) {
      // Process potential data rows after the header
      for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for specific account types in this line
        for (const accountType of accountTypes) {
          if (line.match(new RegExp(`\\b${accountType}\\b`, 'i')) && !processedTypes.has(accountType)) {
            console.log(`Processing line for ${accountType}:`, line);
            
            // Extract data specific to this account type
            const summary = extractDataFromLine(line, accountType, entities, columnMapping);
            summariesByType.set(accountType, summary);
            processedTypes.add(accountType);
            break; // Found a match for this line, move to next line
          }
        }
      }
    }
    
    // If we couldn't process some account types, try a less structured approach
    if (processedTypes.size < accountTypes.length) {
      console.log("Some account types weren't found, trying alternative approach");
      
      // Look for lines containing account type keywords
      for (const accountType of accountTypes) {
        if (!processedTypes.has(accountType)) {
          // Find lines with this account type
          const typeLine = lines.find(line => 
            line.match(new RegExp(`\\b${accountType}\\b`, 'i'))
          );
          
          if (typeLine) {
            console.log(`Found line for account type ${accountType}:`, typeLine);
            const summary = extractDataFromLine(typeLine, accountType, entities, columnMapping);
            summariesByType.set(accountType, summary);
          }
        }
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

// Extract data from a line for a specific account type
function extractDataFromLine(
  line: string, 
  accountType: string, 
  entities: any[], 
  columnMapping: Record<string, number>
): AccountSummary {
  const summary = createDefaultSummary(accountType);
  
  // Find position of account type in the line
  const accountTypePos = line.toLowerCase().indexOf(accountType.toLowerCase());
  if (accountTypePos < 0) return summary;
  
  try {
    // Only extract data for the specific account type on this line
    // This prevents data from other account types being mixed together
    
    // First approach: Use column positions to extract data
    if (Object.keys(columnMapping).length >= 3) {
      // Extract values based on column positions
      const textAfterType = line.substring(accountTypePos + accountType.length);
      
      // Track the columns we've processed
      const processedColumns = new Set<string>();
      processedColumns.add('accountType'); // Already handled
      
      // Sort columns by their position for sequential processing
      const sortedColumns = Object.entries(columnMapping)
        .sort((a, b) => a[1] - b[1])
        .map(entry => entry[0]);
      
      // Process each column based on its position
      for (let i = 0; i < sortedColumns.length; i++) {
        const column = sortedColumns[i];
        if (processedColumns.has(column)) continue;
        
        // Calculate the start and end positions for this column's data
        const startPos = columnMapping[column];
        const endPos = i < sortedColumns.length - 1 ? columnMapping[sortedColumns[i + 1]] : line.length;
        
        // Extract cell content
        if (startPos < line.length) {
          // Use absolute position in the line
          const cellContent = line.substring(
            Math.max(startPos, 0),
            endPos < line.length ? endPos : line.length
          ).trim();
          
          // Process the cell content based on column type
          processColumnValue(summary, column, cellContent);
          processedColumns.add(column);
        }
      }
    } else {
      // Fallback to simpler extraction if column positions aren't reliable
      fallbackProcessing(summary, line, accountType, accountTypePos);
    }
    
    return summary;
  } catch (error) {
    console.error(`Error extracting data for ${accountType}:`, error);
    return createDefaultSummary(accountType);
  }
}

// Process a column value and assign it to the appropriate field in the summary
function processColumnValue(summary: AccountSummary, column: string, cellContent: string): void {
  if (!cellContent) return;
  
  switch (column) {
    case 'open':
      const openValue = extractFirstNumber(cellContent);
      if (openValue !== null) summary.open = openValue;
      break;
      
    case 'withBalance':
      const withBalanceValue = extractFirstNumber(cellContent);
      if (withBalanceValue !== null) summary.withBalance = withBalanceValue;
      break;
      
    case 'totalBalance':
      const totalBalanceValue = extractFirstDollar(cellContent);
      if (totalBalanceValue) summary.totalBalance = totalBalanceValue;
      break;
      
    case 'available':
      const availableValue = extractFirstDollar(cellContent);
      if (availableValue) summary.available = availableValue;
      break;
      
    case 'creditLimit':
      const creditLimitValue = extractFirstDollar(cellContent);
      if (creditLimitValue) summary.creditLimit = creditLimitValue;
      break;
      
    case 'debtToCredit':
      const debtToCreditValue = extractPercentage(cellContent);
      if (debtToCreditValue) summary.debtToCredit = debtToCreditValue;
      break;
      
    case 'payment':
      const paymentValue = extractFirstDollar(cellContent);
      if (paymentValue) summary.payment = paymentValue;
      break;
  }
}

// Fallback to the previous approach if column mapping fails
function fallbackProcessing(summary: AccountSummary, line: string, accountType: string, accountTypePos: number): void {
  // Get text after account type
  const afterAccountType = line.substring(accountTypePos + accountType.length).trim();
  console.log(`Processing data after "${accountType}" (fallback): ${afterAccountType}`);
  
  // Extract numeric values (Open, With Balance)
  const numericValues = extractNumericValues(afterAccountType);
  if (numericValues.length >= 1) {
    summary.open = numericValues[0];
  }
  if (numericValues.length >= 2) {
    summary.withBalance = numericValues[1];
  }
  
  // Extract dollar amounts
  const dollarValues = extractDollarValues(afterAccountType);
  
  // Fixed: Use explicit type checking for each field to avoid type errors
  if (dollarValues.length >= 1) {
    summary.totalBalance = dollarValues[0];
  }
  if (dollarValues.length >= 2) {
    summary.available = dollarValues[1];
  }
  if (dollarValues.length >= 3) {
    summary.creditLimit = dollarValues[2];
  }
  if (dollarValues.length >= 4) {
    summary.payment = dollarValues[3];
  }
  
  // Extract debt-to-credit percentage
  const debtToCredit = extractPercentage(afterAccountType);
  if (debtToCredit) {
    summary.debtToCredit = debtToCredit;
  }
}

// Helper to extract the first number from text
function extractFirstNumber(text: string): number | null {
  const match = text.match(/\b\d+\b/);
  return match ? parseInt(match[0], 10) : null;
}

// Helper to extract the first dollar value from text
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

// Extract numeric values from text (for Open and With Balance)
function extractNumericValues(text: string): number[] {
  const values: number[] = [];
  const matches = text.match(/\b\d+\b/g) || [];
  
  // Only get the first few numbers, which are generally Open and With Balance
  matches.slice(0, 3).forEach(match => {
    values.push(parseInt(match, 10));
  });
  
  return values;
}

// Extract dollar values from text
function extractDollarValues(text: string): string[] {
  const values: string[] = [];
  // This regex matches patterns like $1,234 or -$1,234 or $-1,234
  const regex = /(-?\$[\d,.]+|\$-[\d,.]+)/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    let value = match[0];
    // Normalize $-1,234 format to -$1,234
    if (value.startsWith('$-')) {
      value = '-$' + value.substring(2);
    }
    values.push(value);
  }
  
  return values;
}

// Extract percentage values from text
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
