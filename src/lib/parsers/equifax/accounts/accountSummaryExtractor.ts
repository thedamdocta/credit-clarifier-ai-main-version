
import { AccountSummary } from "../../../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";
import { createEmptyAccountSummaries } from "./types";
import { 
  extractCreditAccountTableSection, 
  findHeaderLine, 
  extractColumnPositions 
} from "./tableExtraction";
import { processAccountType } from "./lineProcessor";

/**
 * Main function to extract account summaries from Equifax report text
 */
export const extractEquifaxAccountSummaries = async (text: string): Promise<AccountSummary[]> => {
  console.log("Starting account summary extraction with isolated row processing");
  parsingLogger.logEvent("Starting equifax account summary extraction with isolated row approach");
  
  // Create empty account summaries structure
  const accountSummaries = createEmptyAccountSummaries();

  try {
    // Extract the credit account table section specifically from the text
    const tableSection = extractCreditAccountTableSection(text);
    if (!tableSection) {
      console.log("No credit account summary table found in the text");
      parsingLogger.logEvent("No credit account summary table found in the text");
      return accountSummaries;
    }
    
    console.log("Found credit account table section, length:", tableSection.length);
    
    // Split the table into lines and filter out empty lines
    const lines = tableSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log("Table section lines:", lines.length);
    
    // Find the header line to understand column positions
    const headerLine = findHeaderLine(lines);
    
    if (!headerLine) {
      console.log("Could not find header line for account summary table");
      return accountSummaries;
    }
    
    console.log("Found header line:", headerLine);
    
    // Get columns positions from the header line
    const columns = extractColumnPositions(headerLine);
    
    if (!columns || Object.keys(columns).length < 7) {
      console.log("Could not extract enough columns from the header line");
      return accountSummaries;
    }
    
    console.log("Extracted column positions:", columns);
    
    // Process each account type individually by finding their specific lines
    processAccountType('Revolving', lines, accountSummaries, columns);
    processAccountType('Mortgage', lines, accountSummaries, columns);
    processAccountType('Installment', lines, accountSummaries, columns);
    processAccountType('Other', lines, accountSummaries, columns); 
    
    // Process Total row last so it doesn't get overridden
    processAccountType('Total', lines, accountSummaries, columns);
    
    // Log all account summaries after processing
    accountSummaries.forEach(summary => {
      console.log(`Final ${summary.accountType} data:`, summary);
    });
    
    console.log("Account summaries extracted with isolated approach:", accountSummaries.length);
    parsingLogger.logEvent("Completed account summary extraction", { count: accountSummaries.length });
    return accountSummaries;
  } catch (error) {
    console.error("Error extracting account summaries:", error);
    parsingLogger.logEvent("Error extracting account summaries", { error: String(error) });
    return accountSummaries; // Return empty structure on error
  }
};
