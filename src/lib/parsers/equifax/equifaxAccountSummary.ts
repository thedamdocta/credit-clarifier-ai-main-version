
import { AccountSummary } from "../../types/creditReport";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction with true cell-by-cell approach");
  
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
    
    // Process the table content strictly line by line
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Log the extracted table section for debugging
    console.log("Extracted table section:");
    lines.forEach((line, i) => console.log(`Line ${i}: ${line}`));
    
    // Process each account type row individually
    for (const accountType of ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total']) {
      const accountIndex = accountSummaries.findIndex(a => a.accountType === accountType);
      if (accountIndex === -1) continue;
      
      // Find the line that contains this account type
      const matchingLines = lines.filter(line => 
        new RegExp(`\\b${accountType}\\b`, 'i').test(line)
      );
      
      if (matchingLines.length === 0) {
        console.log(`No line found for account type: ${accountType}`);
        continue;
      }
      
      const accountLine = matchingLines[0];
      console.log(`Processing line for ${accountType}: ${accountLine}`);
      
      // Extract values for this account type only if they exist in the line
      extractExactCellValues(accountLine, accountSummaries[accountIndex]);
    }
    
    // Clean up any duplicate or incorrect data
    cleanupSummaryData(accountSummaries);
    
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
    const genericMatch = text.match(/((?:Revolving|Mortgage|Installment|Other|Total)[\s\S]+?(?:Revolving|Mortgage|Installment|Other|Total)[\s\S]+?(?:Other Items|Summary of|Consumer Statement|Public Records|End of Report))/i);
    if (genericMatch && genericMatch[1]) {
      tableSection = genericMatch[1];
      console.log("Found table section using generic approach");
    }
  }
  
  return tableSection;
}

function extractExactCellValues(line: string, summary: AccountSummary): void {
  // Clean and normalize the line
  const cleanLine = line.replace(/\s+/g, ' ').trim();
  console.log(`Cleaned line: ${cleanLine}`);
  
  // Extract the account type first to anchor our position
  const accountTypeMatch = cleanLine.match(/\b(Revolving|Mortgage|Installment|Other|Total)\b/i);
  if (!accountTypeMatch) return;
  
  const accountType = accountTypeMatch[1];
  const startPos = cleanLine.indexOf(accountType) + accountType.length;
  const remainingText = cleanLine.substring(startPos).trim();
  console.log(`Remaining text after ${accountType}: "${remainingText}"`);
  
  // Split the remaining text into tokens, preserving dollar amounts and percentages
  const tokens = tokenizeRemainingText(remainingText);
  console.log(`Tokens for ${accountType}:`, tokens);
  
  // Map tokens to specific columns based on their format and position
  let currentCol = 0;
  
  for (const token of tokens) {
    // Skip empty or invalid tokens
    if (!token || token === '') continue;
    
    // Check if token is a simple integer (usually Open or With Balance columns)
    if (/^\d+$/.test(token)) {
      if (currentCol === 0) {
        summary.open = parseInt(token);
        currentCol++;
      } else if (currentCol === 1) {
        summary.withBalance = parseInt(token);
        currentCol++;
      }
      continue;
    }
    
    // Check if token is a dollar amount (balance, available, limit, or payment)
    if (/^\$[\d,]+|^\-\$[\d,]+/.test(token)) {
      if (currentCol <= 1) {
        // If we haven't set open/withBalance yet, skip ahead
        currentCol = 2;
      }
      
      if (currentCol === 2) {
        summary.totalBalance = token;
        currentCol++;
      } else if (currentCol === 3) {
        summary.available = token;
        currentCol++;
      } else if (currentCol === 4) {
        summary.creditLimit = token;
        currentCol++;
      } else if (currentCol === 6) { // Skip debt-to-credit ratio
        summary.payment = token;
      }
      continue;
    }
    
    // Check if token is a percentage (debt-to-credit)
    if (/^\d+\.?\d*\%$/.test(token)) {
      summary.debtToCredit = token;
      currentCol = 6; // Move to payment column next
    }
  }
}

function tokenizeRemainingText(text: string): string[] {
  // This function breaks the line into tokens while preserving special formats
  
  // First capture dollar amounts with their sign
  const dollarMatches = text.match(/\-?\$[\d,]+|\$\-[\d,]+/g) || [];
  
  // Then capture percentages
  const percentMatches = text.match(/\d+\.?\d*\%/g) || [];
  
  // Remove these special patterns from text to process remaining numbers
  let cleanedText = text;
  [...dollarMatches, ...percentMatches].forEach(match => {
    cleanedText = cleanedText.replace(match, " *** ");
  });
  
  // Get remaining numbers
  const numberMatches = cleanedText.match(/\b\d+\b/g) || [];
  
  // Now reconstruct tokens in their original order
  const tokens: string[] = [];
  let currentDollarIndex = 0;
  let currentPercentIndex = 0;
  let currentNumberIndex = 0;
  
  // Simple tokenization by whitespace
  const chunks = text.split(/\s+/);
  for (const chunk of chunks) {
    if (chunk.match(/\-?\$[\d,]+|\$\-[\d,]+/)) {
      tokens.push(dollarMatches[currentDollarIndex++]);
    } else if (chunk.match(/\d+\.?\d*\%/)) {
      tokens.push(percentMatches[currentPercentIndex++]);
    } else if (chunk.match(/\b\d+\b/)) {
      tokens.push(numberMatches[currentNumberIndex++]);
    }
    // Skip other text
  }
  
  return tokens;
}

function cleanupSummaryData(summaries: AccountSummary[]): void {
  // Remove duplicated data across rows
  // We'll trust the data in its original row and clear it from other rows
  
  // Check for null rows that shouldn't have data
  for (const summary of summaries) {
    // If a row has almost no data, clear any potentially misplaced values
    const hasValues = [
      summary.open, 
      summary.withBalance, 
      summary.totalBalance, 
      summary.available, 
      summary.creditLimit
    ].filter(v => v !== null).length;
    
    if (hasValues <= 1) {
      // This row probably doesn't have real data, reset all financial values
      summary.totalBalance = null;
      summary.available = null;
      summary.creditLimit = null;
      summary.debtToCredit = null;
      summary.payment = null;
    }
  }
}
