
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
    
    console.log("Processing account summaries individually for each account type");

    // Process each type individually, no shared logic between them
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
 * Process the Revolving row specifically - now strictly respecting empty values
 */
function processRevolving(lines: string[], accountSummaries: AccountSummary[]): void {
  // Find the Revolving row - being very specific about the pattern
  const revolvingRows = lines.filter(line => {
    const trimmedLine = line.trim();
    return trimmedLine.startsWith("Revolving") || 
           (trimmedLine.includes("Revolving") && 
            !trimmedLine.includes("Account Type") && 
            !trimmedLine.includes("Mortgage") && 
            !trimmedLine.includes("Installment") && 
            !trimmedLine.includes("Other") && 
            !trimmedLine.includes("Total"));
  });
  
  if (revolvingRows.length > 0) {
    const revolvingRow = revolvingRows[0];
    console.log("Processing line for Revolving:", revolvingRow);
    
    // Get the Revolving summary object
    const revolvingSummary = accountSummaries.find(s => s.accountType === 'Revolving');
    if (!revolvingSummary) return;
    
    // Extract data using strict word-based approach
    const words = revolvingRow.split(/\s+/).filter(word => word.trim() !== '');
    
    // Check if after "Revolving" there's a numeric value for "Open"
    let openValueIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].toLowerCase() === 'revolving') {
        openValueIndex = i + 1;
        break;
      }
    }
    
    // Only process "Open" value if it exists and is numeric
    if (openValueIndex >= 0 && openValueIndex < words.length && /^\d+$/.test(words[openValueIndex])) {
      revolvingSummary.open = parseInt(words[openValueIndex], 10);
      
      // Check for "With Balance" value (should be the next numeric value)
      const withBalanceValueIndex = openValueIndex + 1;
      if (withBalanceValueIndex < words.length && /^\d+$/.test(words[withBalanceValueIndex])) {
        revolvingSummary.withBalance = parseInt(words[withBalanceValueIndex], 10);
      }
    }
    
    // DO NOT automatically add dollar values or other fields if they're not explicitly for Revolving
    // All other fields remain null as initialized
  } else {
    console.log("No specific Revolving row found");
  }
}

// Process Mortgage row specifically
function processMortgage(lines: string[], accountSummaries: AccountSummary[]): void {
  const mortgageRows = lines.filter(line => {
    const trimmedLine = line.trim();
    return trimmedLine.startsWith("Mortgage") || 
           (trimmedLine.includes("Mortgage") && 
            !trimmedLine.includes("Account Type") && 
            !trimmedLine.includes("Revolving") && 
            !trimmedLine.includes("Installment") && 
            !trimmedLine.includes("Other") && 
            !trimmedLine.includes("Total"));
  });
  
  if (mortgageRows.length > 0) {
    const mortgageRow = mortgageRows[0];
    console.log("Processing line for Mortgage:", mortgageRow);
    
    const mortgageSummary = accountSummaries.find(s => s.accountType === 'Mortgage');
    if (!mortgageSummary) return;
    
    // Extract data specifically for Mortgage row
    const words = mortgageRow.split(/\s+/).filter(word => word.trim() !== '');
    
    let openValueIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].toLowerCase() === 'mortgage') {
        openValueIndex = i + 1;
        break;
      }
    }
    
    if (openValueIndex >= 0 && openValueIndex < words.length && /^\d+$/.test(words[openValueIndex])) {
      mortgageSummary.open = parseInt(words[openValueIndex], 10);
      
      const withBalanceValueIndex = openValueIndex + 1;
      if (withBalanceValueIndex < words.length && /^\d+$/.test(words[withBalanceValueIndex])) {
        mortgageSummary.withBalance = parseInt(words[withBalanceValueIndex], 10);
      }
    }
    
    // Look for dollar values in this specific row
    const dollarValueMatches = mortgageRow.match(/\$[0-9,.]+|-\$[0-9,.]+|\$-[0-9,.]+/g);
    if (dollarValueMatches && dollarValueMatches.length > 0) {
      // Assign dollar values in the expected order
      if (dollarValueMatches.length >= 1) mortgageSummary.totalBalance = dollarValueMatches[0];
      if (dollarValueMatches.length >= 2) mortgageSummary.available = dollarValueMatches[1];
      if (dollarValueMatches.length >= 3) mortgageSummary.creditLimit = dollarValueMatches[2];
      if (dollarValueMatches.length >= 4) mortgageSummary.payment = dollarValueMatches[3];
    }
    
    // Check for debt-to-credit percentage
    const percentMatch = mortgageRow.match(/(\d+\.?\d*)\s*%/);
    if (percentMatch) {
      mortgageSummary.debtToCredit = percentMatch[0];
    }
  }
}

// Process Installment row specifically
function processInstallment(lines: string[], accountSummaries: AccountSummary[]): void {
  const installmentRows = lines.filter(line => {
    const trimmedLine = line.trim();
    return trimmedLine.startsWith("Installment") || 
           (trimmedLine.includes("Installment") && 
            !trimmedLine.includes("Account Type") && 
            !trimmedLine.includes("Revolving") && 
            !trimmedLine.includes("Mortgage") && 
            !trimmedLine.includes("Other") && 
            !trimmedLine.includes("Total"));
  });
  
  if (installmentRows.length > 0) {
    const installmentRow = installmentRows[0];
    console.log("Processing line for Installment:", installmentRow);
    
    const installmentSummary = accountSummaries.find(s => s.accountType === 'Installment');
    if (!installmentSummary) return;
    
    // Extract data specifically for Installment row
    const words = installmentRow.split(/\s+/).filter(word => word.trim() !== '');
    
    let openValueIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].toLowerCase() === 'installment') {
        openValueIndex = i + 1;
        break;
      }
    }
    
    if (openValueIndex >= 0 && openValueIndex < words.length && /^\d+$/.test(words[openValueIndex])) {
      installmentSummary.open = parseInt(words[openValueIndex], 10);
      
      const withBalanceValueIndex = openValueIndex + 1;
      if (withBalanceValueIndex < words.length && /^\d+$/.test(words[withBalanceValueIndex])) {
        installmentSummary.withBalance = parseInt(words[withBalanceValueIndex], 10);
      }
    }
    
    // Look for dollar values in this specific row
    const dollarValueMatches = installmentRow.match(/\$[0-9,.]+|-\$[0-9,.]+|\$-[0-9,.]+/g);
    if (dollarValueMatches && dollarValueMatches.length > 0) {
      // Assign dollar values in the expected order
      if (dollarValueMatches.length >= 1) installmentSummary.totalBalance = dollarValueMatches[0];
      if (dollarValueMatches.length >= 2) installmentSummary.available = dollarValueMatches[1];
      if (dollarValueMatches.length >= 3) installmentSummary.creditLimit = dollarValueMatches[2];
      if (dollarValueMatches.length >= 4) installmentSummary.payment = dollarValueMatches[3];
    }
    
    // Check for debt-to-credit percentage
    const percentMatch = installmentRow.match(/(\d+\.?\d*)\s*%/);
    if (percentMatch) {
      installmentSummary.debtToCredit = percentMatch[0];
    }
  }
}

// Process Other row specifically
function processOther(lines: string[], accountSummaries: AccountSummary[]): void {
  const otherRows = lines.filter(line => {
    const trimmedLine = line.trim();
    return (trimmedLine.startsWith("Other ") || trimmedLine === "Other") && 
           !trimmedLine.includes("Account Type") && 
           !trimmedLine.includes("Revolving") && 
           !trimmedLine.includes("Mortgage") && 
           !trimmedLine.includes("Installment") && 
           !trimmedLine.includes("Total");
  });
  
  if (otherRows.length > 0) {
    const otherRow = otherRows[0];
    console.log("Processing line for Other:", otherRow);
    
    const otherSummary = accountSummaries.find(s => s.accountType === 'Other');
    if (!otherSummary) return;
    
    // Extract data specifically for Other row
    const words = otherRow.split(/\s+/).filter(word => word.trim() !== '');
    
    let openValueIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].toLowerCase() === 'other') {
        openValueIndex = i + 1;
        break;
      }
    }
    
    if (openValueIndex >= 0 && openValueIndex < words.length && /^\d+$/.test(words[openValueIndex])) {
      otherSummary.open = parseInt(words[openValueIndex], 10);
      
      const withBalanceValueIndex = openValueIndex + 1;
      if (withBalanceValueIndex < words.length && /^\d+$/.test(words[withBalanceValueIndex])) {
        otherSummary.withBalance = parseInt(words[withBalanceValueIndex], 10);
      }
    }
    
    // Look for dollar values in this specific row
    const dollarValueMatches = otherRow.match(/\$[0-9,.]+|-\$[0-9,.]+|\$-[0-9,.]+/g);
    if (dollarValueMatches && dollarValueMatches.length > 0) {
      // Assign dollar values in the expected order
      if (dollarValueMatches.length >= 1) otherSummary.totalBalance = dollarValueMatches[0];
      if (dollarValueMatches.length >= 2) otherSummary.available = dollarValueMatches[1];
      if (dollarValueMatches.length >= 3) otherSummary.creditLimit = dollarValueMatches[2];
      if (dollarValueMatches.length >= 4) otherSummary.payment = dollarValueMatches[3];
    }
    
    // Check for debt-to-credit percentage
    const percentMatch = otherRow.match(/(\d+\.?\d*)\s*%/);
    if (percentMatch) {
      otherSummary.debtToCredit = percentMatch[0];
    }
  }
}

// Process Total row specifically
function processTotal(lines: string[], accountSummaries: AccountSummary[]): void {
  const totalRows = lines.filter(line => {
    const trimmedLine = line.trim();
    return trimmedLine.startsWith("Total") || 
           (trimmedLine.includes("Total") && 
            !trimmedLine.includes("Account Type") && 
            !trimmedLine.includes("Revolving") && 
            !trimmedLine.includes("Mortgage") && 
            !trimmedLine.includes("Installment") && 
            !trimmedLine.includes("Other"));
  });
  
  if (totalRows.length > 0) {
    const totalRow = totalRows[0];
    console.log("Processing line for Total:", totalRow);
    
    const totalSummary = accountSummaries.find(s => s.accountType === 'Total');
    if (!totalSummary) return;
    
    // Extract data specifically for Total row
    const words = totalRow.split(/\s+/).filter(word => word.trim() !== '');
    
    let openValueIndex = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].toLowerCase() === 'total') {
        openValueIndex = i + 1;
        break;
      }
    }
    
    if (openValueIndex >= 0 && openValueIndex < words.length && /^\d+$/.test(words[openValueIndex])) {
      totalSummary.open = parseInt(words[openValueIndex], 10);
      
      const withBalanceValueIndex = openValueIndex + 1;
      if (withBalanceValueIndex < words.length && /^\d+$/.test(words[withBalanceValueIndex])) {
        totalSummary.withBalance = parseInt(words[withBalanceValueIndex], 10);
      }
    }
    
    // Look for dollar values in this specific row
    const dollarValueMatches = totalRow.match(/\$[0-9,.]+|-\$[0-9,.]+|\$-[0-9,.]+/g);
    if (dollarValueMatches && dollarValueMatches.length > 0) {
      // Assign dollar values in the expected order
      if (dollarValueMatches.length >= 1) totalSummary.totalBalance = dollarValueMatches[0];
      if (dollarValueMatches.length >= 2) totalSummary.available = dollarValueMatches[1];
      if (dollarValueMatches.length >= 3) totalSummary.creditLimit = dollarValueMatches[2];
      if (dollarValueMatches.length >= 4) totalSummary.payment = dollarValueMatches[3];
    }
    
    // Check for debt-to-credit percentage
    const percentMatch = totalRow.match(/(\d+\.?\d*)\s*%/);
    if (percentMatch) {
      totalSummary.debtToCredit = percentMatch[0];
    }
  }
}
