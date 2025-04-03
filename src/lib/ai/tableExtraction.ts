
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
      const openAIResults = await extractTableWithOpenAI(imageUrl);
      
      if (openAIResults && openAIResults.length > 0) {
        console.log("Successfully extracted table with OpenAI");
        return {
          headers: ["Account Type", "Open", "With Balance", "Total Balance", "Available", "Credit Limit", "Debt-to-Credit", "Payment"],
          rows: openAIResults.map(account => [
            account.accountType,
            account.open || "",
            account.withBalance || "",
            account.totalBalance || "",
            account.available || "",
            account.creditLimit || "",
            account.debtToCredit || "",
            account.payment || ""
          ]),
          confidence: 0.95,
          matchScore: 100,
          isTargetTable: true
        };
      }
    }
    
    // Fall back to basic recognition
    console.log("Falling back to basic table extraction");
    
    // Simulate table extraction (in a real app, this would use computer vision)
    // Return mock data for now to test the UI flow
    return {
      headers: ["Account Type", "Open", "With Balance", "Total Balance", "Available", "Credit Limit", "Debt-to-Credit", "Payment"],
      rows: [],
      confidence: 0.5,
      matchScore: 50,
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
      return [];
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
    
    // Filter rows that have account type values we're looking for
    const requiredAccountTypes = ['revolving', 'mortgage', 'installment', 'other', 'total'];
    
    const accountSummaries: AccountSummary[] = [];
    
    // Process each row
    tableData.rows.forEach(row => {
      if (!row || row.length === 0) return;
      
      const accountType = accountTypeIndex >= 0 ? row[accountTypeIndex]?.trim() : '';
      const lowerAccountType = accountType.toLowerCase();
      
      if (!requiredAccountTypes.includes(lowerAccountType)) {
        return; // Skip rows that don't match our account types
      }
      
      // Format the account type to capitalize first letter
      const formattedAccountType = accountType.charAt(0).toUpperCase() + accountType.slice(1).toLowerCase();
      
      accountSummaries.push({
        accountType: formattedAccountType,
        totalAccounts: null,
        open: openIndex >= 0 ? row[openIndex]?.trim() || null : null,
        withBalance: withBalanceIndex >= 0 ? row[withBalanceIndex]?.trim() || null : null,
        closed: null,
        balance: null,
        totalBalance: totalBalanceIndex >= 0 ? row[totalBalanceIndex]?.trim() || null : null,
        available: availableIndex >= 0 ? row[availableIndex]?.trim() || null : null,
        creditLimit: creditLimitIndex >= 0 ? row[creditLimitIndex]?.trim() || null : null,
        debtToCredit: debtToCreditIndex >= 0 ? row[debtToCreditIndex]?.trim() || null : null,
        payment: paymentIndex >= 0 ? row[paymentIndex]?.trim() || null : null
      });
    });
    
    console.log("Generated account summaries:", accountSummaries);
    
    // If we didn't find all the required account types, add empty ones
    requiredAccountTypes.forEach(accountType => {
      const formattedAccountType = accountType.charAt(0).toUpperCase() + accountType.slice(1).toLowerCase();
      if (!accountSummaries.some(summary => summary.accountType.toLowerCase() === accountType)) {
        accountSummaries.push({
          accountType: formattedAccountType,
          totalAccounts: null,
          open: null,
          withBalance: null,
          closed: null,
          balance: null,
          totalBalance: null,
          available: null,
          creditLimit: null,
          debtToCredit: null,
          payment: null
        });
      }
    });
    
    return accountSummaries;
  } catch (error) {
    console.error("Error converting table data to account summaries:", error);
    return [];
  }
}
