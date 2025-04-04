
import { ExtractedTableData, FormattedTableData } from "./table/types";
import { extractTableWithOpenAI, canUseOpenAI } from "./openai/openaiService";
import { AccountSummary } from "../types/creditReport";
import { toast } from "sonner";

// Extract table data from an image
export async function extractTableFromImage(imageUrl: string): Promise<ExtractedTableData | null> {
  try {
    console.log("Attempting to extract table from image:", imageUrl);
    
    // First try OpenAI extraction if available
    if (canUseOpenAI()) {
      console.log("OpenAI API is available, attempting AI-based extraction");
      try {
        const openAIResults = await extractTableWithOpenAI(imageUrl);
        
        if (openAIResults && openAIResults.length > 0) {
          console.log("Successfully extracted table with OpenAI");
          
          // Log the data for debugging
          console.log("Extracted table data:", {
            headers: ["Account Type", "Open", "With Balance", "Total Balance", "Available", "Credit Limit", "Debt-to-Credit", "Payment"],
            rows: openAIResults.map(account => [
              account.accountType || "",
              account.open || "",
              account.withBalance || "",
              account.totalBalance || "",
              account.available || "",
              account.creditLimit || "",
              account.debtToCredit || "",
              account.payment || ""
            ]),
            matchScore: 0.9,
            extractionMethod: "openai"
          });
          
          // Only return data if we have actual values
          const hasRealValues = openAIResults.some(account => 
            (account.open !== null && account.open !== "0") || 
            (account.withBalance !== null && account.withBalance !== "0") || 
            (account.totalBalance !== null && account.totalBalance !== "$0" && account.totalBalance !== "0")
          );
          
          if (hasRealValues) {
            return {
              headers: ["Account Type", "Open", "With Balance", "Total Balance", "Available", "Credit Limit", "Debt-to-Credit", "Payment"],
              rows: openAIResults.map(account => [
                String(account.accountType || ""),
                String(account.open || ""),
                String(account.withBalance || ""),
                String(account.totalBalance || ""),
                String(account.available || ""),
                String(account.creditLimit || ""),
                String(account.debtToCredit || ""),
                String(account.payment || "")
              ]),
              confidence: 0.95,
              matchScore: 0.9,
              isTargetTable: true
            };
          } else {
            console.log("OpenAI extraction returned data but with no real values");
          }
        } else {
          console.log("OpenAI extraction returned no data or empty results");
        }
      } catch (error) {
        console.error("Error extracting data with OpenAI:", error);
        toast.error("Failed to extract data with AI. Please try again or upload a clearer image.");
      }
    } else {
      console.log("OpenAI API is not available for extraction");
    }
    
    // Fall back to basic recognition
    console.log("Falling back to basic table extraction");
    
    // Create empty table data structure for fallback
    return {
      headers: ["Account Type", "Open", "With Balance", "Total Balance", "Available", "Credit Limit", "Debt-to-Credit", "Payment"],
      rows: [],
      confidence: 0.5,
      matchScore: 0.5,
      isTargetTable: true
    };
  } catch (error) {
    console.error("Error extracting table from image:", error);
    return null;
  }
}

// Convert extracted table data to account summaries
export function convertTableToAccountSummaries(tableData: ExtractedTableData): AccountSummary[] {
  try {
    if (!tableData || !tableData.rows || tableData.rows.length === 0) {
      console.error("No table data to convert to account summaries");
      // Return empty account summaries for required types
      return createEmptyAccountSummaries();
    }
    
    console.log("Converting table data to account summaries:", tableData);
    
    // Get header indices for mapping
    const headers = tableData.headers.map(h => h.toLowerCase().trim());
    const accountTypeIndex = headers.findIndex(h => h.includes("account") || h.includes("type"));
    const openIndex = headers.findIndex(h => h === "open");
    const withBalanceIndex = headers.findIndex(h => h.includes("with") && h.includes("balance"));
    const totalBalanceIndex = headers.findIndex(h => h.includes("total") && h.includes("balance"));
    const availableIndex = headers.findIndex(h => h.includes("available"));
    const creditLimitIndex = headers.findIndex(h => h.includes("credit") && h.includes("limit"));
    const debtToCreditIndex = headers.findIndex(h => h.includes("debt") || h.includes("ratio"));
    const paymentIndex = headers.findIndex(h => h.includes("payment"));
    
    // Required account types we need to have
    const requiredAccountTypes = ['revolving', 'mortgage', 'installment', 'other', 'total'];
    
    const accountSummaries: AccountSummary[] = [];
    
    // Process each row
    tableData.rows.forEach(row => {
      if (!row || row.length === 0) return;
      
      const accountType = accountTypeIndex >= 0 ? String(row[accountTypeIndex]?.trim() || "") : '';
      const lowerAccountType = accountType.toLowerCase();
      
      // Process all rows, even if they don't match the expected account types
      // This helps in case the OCR doesn't detect the account type correctly
      
      // Format the account type to capitalize first letter
      let formattedAccountType = accountType;
      if (accountType) {
        formattedAccountType = accountType.charAt(0).toUpperCase() + accountType.slice(1).toLowerCase();
      }
      
      // If it's a completely unrecognized type, skip it
      if (!formattedAccountType && !requiredAccountTypes.includes(lowerAccountType)) {
        return;
      }
      
      accountSummaries.push({
        // Required properties from the interface
        type: formattedAccountType,
        count: 0,
        highCredit: null,
        pastDue: null,
        balance: null,
        payment: null,

        // Additional properties used in the code
        accountType: formattedAccountType,
        totalAccounts: null,
        open: openIndex >= 0 ? String(row[openIndex]?.trim() || null) : null,
        withBalance: withBalanceIndex >= 0 ? String(row[withBalanceIndex]?.trim() || null) : null,
        closed: null,
        totalBalance: totalBalanceIndex >= 0 ? String(row[totalBalanceIndex]?.trim() || null) : null,
        available: availableIndex >= 0 ? String(row[availableIndex]?.trim() || null) : null,
        creditLimit: creditLimitIndex >= 0 ? String(row[creditLimitIndex]?.trim() || null) : null,
        debtToCredit: debtToCreditIndex >= 0 ? String(row[debtToCreditIndex]?.trim() || null) : null
      });
    });
    
    console.log("Generated account summaries:", accountSummaries);
    
    // If we didn't find all the required account types, add empty ones
    const result = ensureAllRequiredAccountTypes(accountSummaries);
    
    // Check if the data has any meaningful values
    const hasRealValues = result.some(summary => 
      (summary.open && summary.open !== "0") || 
      (summary.withBalance && summary.withBalance !== "0") || 
      (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0")
    );
    
    if (!hasRealValues) {
      console.log("Extracted data had no meaningful values - extraction failed");
    }
    
    return result;
  } catch (error) {
    console.error("Error converting table data to account summaries:", error);
    return createEmptyAccountSummaries();
  }
}

// Helper function to create empty account summaries for required types
function createEmptyAccountSummaries(): AccountSummary[] {
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  return requiredAccountTypes.map(accountType => ({
    // Required properties from the interface
    type: accountType,
    count: 0,
    highCredit: null,
    pastDue: null,
    balance: null,
    payment: null,
    
    // Additional properties used in the code
    accountType,
    totalAccounts: null,
    open: null,
    withBalance: null,
    closed: null,
    totalBalance: null,
    available: null,
    creditLimit: null,
    debtToCredit: null
  }));
}

// Helper function to ensure all required account types are present
function ensureAllRequiredAccountTypes(summaries: AccountSummary[]): AccountSummary[] {
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  const result = [...summaries];
  
  requiredAccountTypes.forEach(accountType => {
    const lowerAccountType = accountType.toLowerCase();
    if (!summaries.some(summary => summary.accountType.toLowerCase() === lowerAccountType)) {
      result.push({
        // Required properties from the interface
        type: accountType,
        count: 0,
        highCredit: null,
        pastDue: null,
        balance: null,
        payment: null,
        
        // Additional properties used in the code
        accountType,
        totalAccounts: null,
        open: null,
        withBalance: null,
        closed: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null
      });
    }
  });
  
  return result;
}
