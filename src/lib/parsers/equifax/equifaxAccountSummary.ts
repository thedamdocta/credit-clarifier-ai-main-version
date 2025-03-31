
import { AccountSummary } from "../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";
import { formatAccountValue } from "@/utils/formatters/accountValueFormatters";

export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction with isolated row processing");
  parsingLogger.logEvent("Starting equifax account summary extraction with isolated row approach");
  
  // Define the empty account summaries structure 
  const accountSummaries: AccountSummary[] = [
    { accountType: 'Revolving', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Mortgage', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Installment', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Other', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Total', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null }
  ];

  try {
    // Extract the table section from the text
    const tableSection = extractTableSection(text);
    if (!tableSection) {
      console.log("No account summary table found in the text");
      parsingLogger.logEvent("No account summary table found in the text");
      return accountSummaries;
    }
    
    // Split the table into lines and filter out empty lines
    const lines = tableSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Find the header line to understand column positions
    const headerLine = findHeaderLine(lines);
    
    if (!headerLine) {
      console.log("Could not find header line for account summary table");
      return accountSummaries;
    }
    
    console.log("Found header line:", headerLine);
    
    // Process each account type with completely isolated extraction functions
    // This ensures no data leakage between different account types
    extractRevolvingAccountLine(lines, accountSummaries);
    extractMortgageAccountLine(lines, accountSummaries);
    extractInstallmentAccountLine(lines, accountSummaries);
    extractOtherAccountLine(lines, accountSummaries);
    extractTotalAccountLine(lines, accountSummaries);
    
    console.log("Account summaries extracted with isolated approach:", accountSummaries.length);
    console.log("Account summaries:", accountSummaries);
    parsingLogger.logEvent("Completed account summary extraction", { count: accountSummaries.length });
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};

/**
 * Extract the table section from the document text
 */
function extractTableSection(text: string): string | null {
  // Look for the account type header row
  const headerPattern = /account\s+type\s+open\s+with\s+balance\s+total\s+balance\s+available\s+credit\s+limit\s+debt-to-credit\s+payment/i;
  const headerMatch = text.match(headerPattern);
  
  if (!headerMatch) {
    return null;
  }
  
  // Get the text from the header to the end of the table
  const headerIndex = headerMatch.index || 0;
  const tableEndPattern = /(?:other items|summary of|consumer statement|public records|end of report)/i;
  const tableEndMatch = text.slice(headerIndex).match(tableEndPattern);
  
  if (tableEndMatch) {
    return text.slice(headerIndex, headerIndex + tableEndMatch.index);
  } else {
    // If we can't find a clear end, just take a reasonable chunk
    return text.slice(headerIndex, headerIndex + 2000); 
  }
}

/**
 * Find the header line in the table to understand column positions
 */
function findHeaderLine(lines: string[]): string | null {
  // Look for the line with all column headers
  const headerPattern = /account\s+type\s+open\s+with\s+balance\s+total\s+balance\s+available\s+credit\s+limit\s+debt-to-credit\s+payment/i;
  
  for (const line of lines) {
    if (headerPattern.test(line)) {
      return line;
    }
  }
  
  return null;
}

/**
 * Isolated extraction function specifically for Revolving accounts
 */
function extractRevolvingAccountLine(lines: string[], accountSummaries: AccountSummary[]): void {
  console.log("Extracting Revolving account line with isolated approach");
  const accountType = 'Revolving';
  
  // Find the line that contains Revolving as a whole word
  const accountLine = lines.find(line => {
    const lowercaseLine = line.toLowerCase();
    // Make sure it's a whole word match for Revolving
    return (lowercaseLine.includes(` ${accountType.toLowerCase()} `) || 
            lowercaseLine.startsWith(`${accountType.toLowerCase()} `) || 
            lowercaseLine.includes(` ${accountType.toLowerCase()}$`));
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract numeric values (Open, With Balance)
  const revolving = extractSpecificAccountTypeData(accountLine, accountType);
  
  // Only assign values that were actually found, leave nulls as is
  if (revolving.open !== null) accountSummary.open = revolving.open;
  if (revolving.withBalance !== null) accountSummary.withBalance = revolving.withBalance;
  if (revolving.totalBalance !== null) accountSummary.totalBalance = revolving.totalBalance;
  if (revolving.available !== null) accountSummary.available = revolving.available;
  if (revolving.creditLimit !== null) accountSummary.creditLimit = revolving.creditLimit;
  if (revolving.debtToCredit !== null) accountSummary.debtToCredit = revolving.debtToCredit;
  if (revolving.payment !== null) accountSummary.payment = revolving.payment;
  
  console.log(`Processed ${accountType} (isolated):`, accountSummary);
}

/**
 * Isolated extraction function specifically for Mortgage accounts
 */
function extractMortgageAccountLine(lines: string[], accountSummaries: AccountSummary[]): void {
  console.log("Extracting Mortgage account line with isolated approach");
  const accountType = 'Mortgage';
  
  // Find the line that contains Mortgage as a whole word
  const accountLine = lines.find(line => {
    const lowercaseLine = line.toLowerCase();
    // Make sure it's a whole word match for Mortgage
    return (lowercaseLine.includes(` ${accountType.toLowerCase()} `) || 
            lowercaseLine.startsWith(`${accountType.toLowerCase()} `) || 
            lowercaseLine.includes(` ${accountType.toLowerCase()}$`));
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values for this specific account type
  const mortgage = extractSpecificAccountTypeData(accountLine, accountType);
  
  // Only assign values that were actually found, leave nulls as is
  if (mortgage.open !== null) accountSummary.open = mortgage.open;
  if (mortgage.withBalance !== null) accountSummary.withBalance = mortgage.withBalance;
  if (mortgage.totalBalance !== null) accountSummary.totalBalance = mortgage.totalBalance;
  if (mortgage.available !== null) accountSummary.available = mortgage.available;
  if (mortgage.creditLimit !== null) accountSummary.creditLimit = mortgage.creditLimit;
  if (mortgage.debtToCredit !== null) accountSummary.debtToCredit = mortgage.debtToCredit;
  if (mortgage.payment !== null) accountSummary.payment = mortgage.payment;
  
  console.log(`Processed ${accountType} (isolated):`, accountSummary);
}

/**
 * Isolated extraction function specifically for Installment accounts
 */
function extractInstallmentAccountLine(lines: string[], accountSummaries: AccountSummary[]): void {
  console.log("Extracting Installment account line with isolated approach");
  const accountType = 'Installment';
  
  // Find the line that contains Installment as a whole word
  const accountLine = lines.find(line => {
    const lowercaseLine = line.toLowerCase();
    // Make sure it's a whole word match for Installment
    return (lowercaseLine.includes(` ${accountType.toLowerCase()} `) || 
            lowercaseLine.startsWith(`${accountType.toLowerCase()} `) || 
            lowercaseLine.includes(` ${accountType.toLowerCase()}$`));
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values for this specific account type
  const installment = extractSpecificAccountTypeData(accountLine, accountType);
  
  // Only assign values that were actually found, leave nulls as is
  if (installment.open !== null) accountSummary.open = installment.open;
  if (installment.withBalance !== null) accountSummary.withBalance = installment.withBalance;
  if (installment.totalBalance !== null) accountSummary.totalBalance = installment.totalBalance;
  if (installment.available !== null) accountSummary.available = installment.available;
  if (installment.creditLimit !== null) accountSummary.creditLimit = installment.creditLimit;
  if (installment.debtToCredit !== null) accountSummary.debtToCredit = installment.debtToCredit;
  if (installment.payment !== null) accountSummary.payment = installment.payment;
  
  console.log(`Processed ${accountType} (isolated):`, accountSummary);
}

/**
 * Isolated extraction function specifically for Other accounts
 */
function extractOtherAccountLine(lines: string[], accountSummaries: AccountSummary[]): void {
  console.log("Extracting Other account line with isolated approach");
  const accountType = 'Other';
  
  // Find the line that contains Other as a whole word
  const accountLine = lines.find(line => {
    const lowercaseLine = line.toLowerCase();
    // Make sure it's a whole word match for Other
    return (lowercaseLine.includes(` ${accountType.toLowerCase()} `) || 
            lowercaseLine.startsWith(`${accountType.toLowerCase()} `) || 
            lowercaseLine.includes(` ${accountType.toLowerCase()}$`));
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values for this specific account type
  const other = extractSpecificAccountTypeData(accountLine, accountType);
  
  // Only assign values that were actually found, leave nulls as is
  if (other.open !== null) accountSummary.open = other.open;
  if (other.withBalance !== null) accountSummary.withBalance = other.withBalance;
  if (other.totalBalance !== null) accountSummary.totalBalance = other.totalBalance;
  if (other.available !== null) accountSummary.available = other.available;
  if (other.creditLimit !== null) accountSummary.creditLimit = other.creditLimit;
  if (other.debtToCredit !== null) accountSummary.debtToCredit = other.debtToCredit;
  if (other.payment !== null) accountSummary.payment = other.payment;
  
  console.log(`Processed ${accountType} (isolated):`, accountSummary);
}

/**
 * Isolated extraction function specifically for Total line
 */
function extractTotalAccountLine(lines: string[], accountSummaries: AccountSummary[]): void {
  console.log("Extracting Total account line with isolated approach");
  const accountType = 'Total';
  
  // Find the line that contains Total as a whole word
  const accountLine = lines.find(line => {
    const lowercaseLine = line.toLowerCase();
    // Make sure it's a whole word match for Total
    return (lowercaseLine.includes(` ${accountType.toLowerCase()} `) || 
            lowercaseLine.startsWith(`${accountType.toLowerCase()} `) || 
            lowercaseLine.includes(` ${accountType.toLowerCase()}$`));
  });
  
  if (!accountLine) {
    console.log(`No line found for ${accountType}`);
    return;
  }
  
  console.log(`Found line for ${accountType}:`, accountLine);
  
  // Find this account type in our summary array
  const accountSummary = accountSummaries.find(summary => summary.accountType === accountType);
  if (!accountSummary) return;
  
  // Extract values for this specific account type
  const total = extractSpecificAccountTypeData(accountLine, accountType);
  
  // Only assign values that were actually found, leave nulls as is
  if (total.open !== null) accountSummary.open = total.open;
  if (total.withBalance !== null) accountSummary.withBalance = total.withBalance;
  if (total.totalBalance !== null) accountSummary.totalBalance = total.totalBalance;
  if (total.available !== null) accountSummary.available = total.available;
  if (total.creditLimit !== null) accountSummary.creditLimit = total.creditLimit;
  if (total.debtToCredit !== null) accountSummary.debtToCredit = total.debtToCredit;
  if (total.payment !== null) accountSummary.payment = total.payment;
  
  console.log(`Processed ${accountType} (isolated):`, accountSummary);
}

/**
 * Extract data for a specific account type in an isolated way
 */
function extractSpecificAccountTypeData(accountLine: string, accountType: string): {
  open: string | null;
  withBalance: string | null;
  totalBalance: string | null;
  available: string | null;
  creditLimit: string | null;
  debtToCredit: string | null;
  payment: string | null;
} {
  // Initialize all values as null
  const result = {
    open: null,
    withBalance: null,
    totalBalance: null,
    available: null,
    creditLimit: null,
    debtToCredit: null,
    payment: null
  };
  
  // Find position of account type in the line
  const accountTypePos = accountLine.indexOf(accountType);
  if (accountTypePos < 0) {
    console.log(`Could not find ${accountType} in line`);
    return result;
  }
  
  // Get text after account type name
  const afterAccountType = accountLine.substring(accountTypePos + accountType.length);
  
  // Create a simplified version of the line with only spaces as separators
  const simplifiedLine = afterAccountType.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = simplifiedLine.split(' ');
  
  // For numeric values (Open, With Balance)
  // These are typically the first two numeric tokens
  let numericCount = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d+$/.test(tokens[i])) {
      if (numericCount === 0) {
        result.open = tokens[i];
      } else if (numericCount === 1) {
        result.withBalance = tokens[i];
      }
      numericCount++;
      if (numericCount >= 2) break;
    }
  }
  
  // Extract dollar values from the line for this account type only
  const dollarValues = extractDollarValuesFromLine(simplifiedLine);
  if (dollarValues.length >= 1) result.totalBalance = dollarValues[0];
  if (dollarValues.length >= 2) result.available = dollarValues[1];
  if (dollarValues.length >= 3) result.creditLimit = dollarValues[2];
  if (dollarValues.length >= 4) result.payment = dollarValues[3];
  
  // Extract percentage for debt-to-credit
  const percentValue = extractPercentage(simplifiedLine);
  if (percentValue) {
    result.debtToCredit = percentValue;
  }
  
  return result;
}

/**
 * Extract dollar values from a text line
 */
function extractDollarValuesFromLine(line: string): string[] {
  // Match both positive ($XXX) and negative (-$XXX or $-XXX) dollar amounts
  const dollarPattern = /(-?\$[\d,.]+|\$-[\d,.]+)/g;
  const dollarValues: string[] = [];
  
  // Find all dollar value matches in the line
  let match;
  while ((match = dollarPattern.exec(line)) !== null) {
    dollarValues.push(match[0]);
  }
  
  return dollarValues;
}

/**
 * Extract percentage value from a text line
 */
function extractPercentage(line: string): string | null {
  const percentPattern = /([\d.]+%)/;
  const percentMatch = line.match(percentPattern);
  
  if (percentMatch && percentMatch[1]) {
    return percentMatch[1];
  }
  
  return null;
}
