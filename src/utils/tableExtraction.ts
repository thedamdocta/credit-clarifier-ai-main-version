
import { extractTextFromImage } from "@/lib/ai/ocrExtraction";
import { toast } from "sonner";

// Define table data structure
export interface TableData {
  headers: string[];
  rows: Array<Record<string, string>>;
  imageUrl?: string;
  confidence?: number;
}

// Define account data structure
export interface AccountData {
  accountType: string;
  open: string | null;
  withBalance: string | null;
  totalBalance: string | null;
  available: string | null;
  creditLimit: string | null;
  debtToCredit: string | null;
  payment: string | null;
}

/**
 * Extract a credit account table from an image
 */
export async function extractTableFromImage(imageUrl: string): Promise<TableData | null> {
  try {
    if (!imageUrl) {
      console.error("No image URL provided for table extraction");
      return null;
    }
    
    console.log("Starting table extraction from image");
    
    // First extract all text from the image
    const extractedText = await extractTextFromImage(imageUrl);
    if (!extractedText) {
      console.error("Failed to extract text from image");
      return null;
    }
    
    console.log("Extracted text:", extractedText);
    
    // Define headers for credit report account table
    const headers = [
      'Account Type', 'Open', 'With Balance', 'Total Balance',
      'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'
    ];
    
    // Initialize table data
    const tableData: TableData = {
      headers,
      rows: [],
      imageUrl
    };
    
    // Define the account types we expect to find
    const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
    
    // Extract data rows using pattern matching
    accountTypes.forEach(accountType => {
      // Create regex patterns to match rows for this account type
      const patterns = [
        // Pattern for complete row with negative available credit
        new RegExp(`${accountType}\\s+(\\d+)\\s+(\\d+)\\s+\\$([\\d,]+)\\s+(-\\$[\\d,]+)\\s+\\$([\\d,]+)\\s+([\\d\\.]+%?)\\s+\\$([\\d,]+)`, 'i'),
        
        // Simpler pattern with fewer columns
        new RegExp(`${accountType}\\s+(\\d+)\\s+(\\d+)\\s+\\$([\\d,]+)`, 'i'),
        
        // Basic pattern just to identify the account type
        new RegExp(`${accountType}\\b`, 'i')
      ];
      
      // Try each pattern in order of specificity
      for (const pattern of patterns) {
        const match = extractedText.match(pattern);
        if (match) {
          console.log(`Found match for ${accountType}:`, match);
          
          // Create row object
          const row: Record<string, string> = {
            'Account Type': accountType
          };
          
          // Add matched data if available
          if (match.length > 3) {
            row['Open'] = match[1] || '';
            row['With Balance'] = match[2] || '';
            row['Total Balance'] = `$${match[3]}` || '';
            
            if (match[4]) row['Available'] = match[4];
            if (match[5]) row['Credit Limit'] = `$${match[5]}`;
            if (match[6]) row['Debt-to-Credit'] = match[6];
            if (match[7]) row['Payment'] = `$${match[7]}`;
          }
          
          // Add row to table
          tableData.rows.push(row);
          break; // Stop after first successful match
        }
      }
    });
    
    // If no rows were extracted, return null
    if (tableData.rows.length === 0) {
      console.error("No account data rows extracted");
      return null;
    }
    
    console.log("Extracted table data:", tableData);
    return tableData;
  } catch (error) {
    console.error("Error extracting table from image:", error);
    return null;
  }
}

/**
 * Convert table data to account data structure
 */
export function convertTableToAccountData(tableData: TableData): AccountData[] {
  if (!tableData || !tableData.rows || tableData.rows.length === 0) {
    return [];
  }
  
  return tableData.rows.map(row => ({
    accountType: row['Account Type'] || '',
    open: row['Open'] || null,
    withBalance: row['With Balance'] || null,
    totalBalance: row['Total Balance'] || null,
    available: row['Available'] || null,
    creditLimit: row['Credit Limit'] || null,
    debtToCredit: row['Debt-to-Credit'] || null,
    payment: row['Payment'] || null
  }));
}

/**
 * Check if extracted data is likely valid
 */
export function validateAccountData(data: AccountData[]): boolean {
  if (!data || data.length === 0) return false;
  
  // Check if we have a Total row
  const hasTotal = data.some(row => row.accountType === 'Total');
  
  // Check if we have at least one numeric value
  const hasNumericValues = data.some(row => 
    row.open || row.withBalance || row.totalBalance || row.available || 
    row.creditLimit || row.debtToCredit || row.payment
  );
  
  return hasTotal && hasNumericValues;
}
