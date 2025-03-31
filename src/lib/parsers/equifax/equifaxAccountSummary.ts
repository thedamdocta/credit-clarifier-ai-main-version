import { AccountSummary } from "../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction for table structure");
  parsingLogger.logEvent("Starting equifax account summary extraction");
  
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
      parsingLogger.logEvent("No account summary table section found");
      return accountSummaries;
    }
    
    // Split into lines for processing
    const lines = tableSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Find the header row to identify column structure
    const headerRow = findHeaderRow(lines);
    if (!headerRow) {
      console.log("Could not find header row");
      parsingLogger.logEvent("No header row found");
      return accountSummaries;
    }
    
    // Process each account type individually with its specific row
    processRevolving(lines, accountSummaries);
    processMortgage(lines, accountSummaries);
    processInstallment(lines, accountSummaries);
    processOther(lines, accountSummaries);
    processTotal(lines, accountSummaries);
    
    console.log("Final extracted account summaries:", accountSummaries);
    parsingLogger.logEvent("Completed account summary extraction", { count: accountSummaries.length });
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

/**
 * Extract the table section containing account summaries
 */
function extractTableSection(text: string): string | null {
  // Find the section with the account summary table
  const tableSectionRegexes = [
    /Your credit report includes information about activity on your credit accounts[\s\S]*?Account Type[\s\S]*?Total/i,
    /Credit Accounts[\s\S]*?Account Type[\s\S]*?Total/i,
  ];
  
  for (const regex of tableSectionRegexes) {
    const match = text.match(regex);
    if (match && match[0]) {
      return match[0];
    }
  }
  
  // Try a more permissive approach
  const tableStart = text.indexOf("Account Type");
  if (tableStart !== -1) {
    const endIndex = text.indexOf("Public Records", tableStart);
    if (endIndex !== -1) {
      return text.substring(tableStart, endIndex);
    } else {
      return text.substring(tableStart, tableStart + 3000); // Reasonable length limit
    }
  }
  
  return null;
}

/**
 * Find the header row in the table
 */
function findHeaderRow(lines: string[]): string | null {
  for (const line of lines) {
    if (line.includes("Account Type") && 
        (line.includes("Open") || line.includes("With Balance") || 
         line.includes("Total Balance"))) {
      return line;
    }
  }
  return null;
}

/**
 * Process the Revolving row specifically
 */
function processRevolving(lines: string[], accountSummaries: AccountSummary[]): void {
  // Find the Revolving row - being very specific about the pattern
  const revolvingRows = lines.filter(line => {
    const trimmedLine = line.trim();
    const startsWithRevolving = /^Revolving\b/.test(trimmedLine);
    const containsRevolvingAsWord = new RegExp('\\bRevolving\\b').test(trimmedLine);
    
    // Exclude header rows and rows where "Revolving" appears as part of another term
    const notHeaderRow = !(/Account Type|Header|Column/i.test(trimmedLine));
    const notOtherRows = !(/Mortgage|Installment|Other|Total/.test(trimmedLine.split(/\s+/)[0])); 
    
    return (startsWithRevolving || (containsRevolvingAsWord && notOtherRows)) && notHeaderRow;
  });
  
  if (revolvingRows.length > 0) {
    const revolvingRow = revolvingRows[0];
    console.log("Found Revolving row:", revolvingRow);
    
    // Get the Revolving summary object
    const revolvingSummary = accountSummaries.find(s => s.accountType === 'Revolving');
    if (revolvingSummary) {
      // Extract data using a word-based approach rather than position-based
      const words = revolvingRow.split(/\s+/).filter(word => word.trim() !== '');
      
      // Word after "Revolving" should be "Open" count if it's a number
      if (words.length > 1 && /^\d+$/.test(words[1])) {
        revolvingSummary.open = parseInt(words[1], 10);
        console.log("Extracted Revolving open:", revolvingSummary.open);
      }
      
      // Next word after open count should be "With Balance" count if it's a number
      if (words.length > 2 && /^\d+$/.test(words[2])) {
        revolvingSummary.withBalance = parseInt(words[2], 10);
        console.log("Extracted Revolving with balance:", revolvingSummary.withBalance);
      }
      
      // For the Revolving row, we'll specifically check if there are dollar values
      // If the row doesn't have dollar values ($), we'll leave them as null
      const dollarValueMatch = revolvingRow.match(/\$[0-9,.]+|-\$[0-9,.]+|\$-[0-9,.]+/g);
      
      // Only populate dollar values if they actually exist in the row
      if (dollarValueMatch && dollarValueMatch.length > 0) {
        // Assign dollar values in expected order only if they exist
        const dollarFields = ['totalBalance', 'available', 'creditLimit', 'payment'];
        dollarValueMatch.forEach((value, index) => {
          if (index < dollarFields.length) {
            revolvingSummary[dollarFields[index]] = value;
          }
        });
      }
      
      // Check for percentage (debt-to-credit) only if it exists
      const percentMatch = revolvingRow.match(/(\d+\.?\d*)\s*%/);
      if (percentMatch) {
        revolvingSummary.debtToCredit = percentMatch[0];
      }
    }
  } else {
    console.log("No specific Revolving row found");
  }
}

// Placeholder for other account type processing functions
function processMortgage(lines: string[], accountSummaries: AccountSummary[]): void {
  // Will implement this after Revolving is working correctly
}

function processInstallment(lines: string[], accountSummaries: AccountSummary[]): void {
  // Will implement this after Revolving is working correctly
}

function processOther(lines: string[], accountSummaries: AccountSummary[]): void {
  // Will implement this after Revolving is working correctly
}

function processTotal(lines: string[], accountSummaries: AccountSummary[]): void {
  // Will implement this after Revolving is working correctly
}
