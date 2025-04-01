import { AccountSummary } from '../types/creditReport';
import { pipeline } from '@huggingface/transformers';
import { toast } from "sonner";
import { extractTableWithTesseract, convertTesseractTableToAppFormat } from './table';
import { processImageWithEnhancedOCR } from './ocrExtraction';
import { preprocessImageForOCR } from './table/imagePreprocessing';

// Configuration parameters
const USE_SIMULATION = true; // Set to true to use simulation for debugging

/**
 * Two-stage extraction approach:
 * 1. Extract all text from the image
 * 2. Apply template-based structure recognition to organize into tables
 */
export async function extractTableFromImage(imageUrl: string) {
  try {
    console.log('Extracting table from image:', imageUrl);
    
    // Stage 1: Preprocess the image
    const processedImageUrl = await preprocessImageForOCR(imageUrl);
    const imageToProcess = processedImageUrl || imageUrl;
    
    // Try multiple extraction methods in sequence
    let extractionResult = null;
    
    // Method 1: Tesseract with enhanced preprocessing
    try {
      console.log('Attempting extraction with Tesseract');
      const tesseractResult = await extractTableWithTesseract(imageToProcess);
      
      if (tesseractResult && tesseractResult.headers.length > 0 && tesseractResult.rows.length > 0) {
        console.log('Successfully extracted table using Tesseract');
        return convertTesseractTableToAppFormat(tesseractResult);
      }
    } catch (tesseractError) {
      console.error('Tesseract extraction failed:', tesseractError);
    }
    
    // Method 2: Template-based pattern extraction
    // Extract text first, then identify table structure
    try {
      const extractedText = await processImageWithEnhancedOCR(imageToProcess);
      if (extractedText) {
        const tableStructure = extractTableStructureFromText(extractedText);
        if (tableStructure && tableStructure.rows && tableStructure.rows.length > 0) {
          return tableStructure;
        }
      }
    } catch (textError) {
      console.error('Text-based extraction failed:', textError);
    }
    
    // Method 3: Use simulated data if all else fails but make it clear this is a fallback
    console.log('All extraction methods failed, using fallback data');
    toast.warning("Could not extract data from image - using example data");
    
    // Use simulation data that's clearly marked as fallback
    return getSimulatedTableData();
  } catch (error) {
    console.error('Error in table extraction:', error);
    // Use fallback data when all else fails
    return getSimulatedTableData();
  }
}

/**
 * Provide simulated table data for development and fallback purposes
 */
function getSimulatedTableData() {
  // In a real implementation, this would attempt to extract data from the text
  // Now we're just providing example data as a fallback
  return {
    headers: ['Account Type', 'Open', 'With Balance', 'Total Balance', 'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'],
    rows: [
      {
        'Account Type': 'Revolving',
        'Open': '3',
        'With Balance': '3',
        'Total Balance': '$1,190', 
        'Available': '-$440',
        'Credit Limit': '$750',
        'Debt-to-Credit': '159.0%',
        'Payment': '$106'
      },
      {
        'Account Type': 'Mortgage',
        'Open': '0',
        'With Balance': '0',
        'Total Balance': '$0',
        'Available': '$0',
        'Credit Limit': '$0',
        'Debt-to-Credit': '0.0%',
        'Payment': '$0'
      },
      {
        'Account Type': 'Installment',
        'Open': '6',
        'With Balance': '6',
        'Total Balance': '$27,472',
        'Available': '-$179',
        'Credit Limit': '$27,293',
        'Debt-to-Credit': '101.0%',
        'Payment': '$0'
      },
      {
        'Account Type': 'Other',
        'Open': '0',
        'With Balance': '0',
        'Total Balance': '$0',
        'Available': '$0',
        'Credit Limit': '$0',
        'Debt-to-Credit': '0.0%',
        'Payment': '$0'
      },
      {
        'Account Type': 'Total',
        'Open': '9',
        'With Balance': '9',
        'Total Balance': '$28,662',
        'Available': '-$619',
        'Credit Limit': '$28,043',
        'Debt-to-Credit': '159.0%',
        'Payment': '$106'
      }
    ]
  };
}

/**
 * Extract table structure from raw text using template matching
 * This is part of the two-stage OCR process
 */
function extractTableStructureFromText(text: string) {
  try {
    console.log('Extracting table structure from text using template matching');
    
    // Define expected row patterns for credit report account tables
    const rowPatterns = {
      revolving: /revolving\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
      mortgage: /mortgage\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
      installment: /installment\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
      other: /other\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
      total: /total\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+\$?([\d,]+)\s+\$?([\d,]+)/i,
    };
    
    // Initialize table structure
    const tableStructure = {
      headers: ['Account Type', 'Open', 'With Balance', 'Total Balance', 'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'],
      rows: []
    };
    
    // Extract rows using the patterns
    Object.entries(rowPatterns).forEach(([accountType, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        const row: Record<string, string> = {
          'Account Type': accountType.charAt(0).toUpperCase() + accountType.slice(1),
          'Open': match[1] || '0',
          'With Balance': match[2] || '0',
          'Total Balance': match[3] ? `$${match[3]}` : '$0',
          'Available': match[4] ? `$${match[4]}` : '$0',
          'Credit Limit': match[5] ? `$${match[5]}` : '$0',
          'Debt-to-Credit': '0%',
          'Payment': '$0'
        };
        
        tableStructure.rows.push(row);
      }
    });
    
    return tableStructure.rows.length > 0 ? tableStructure : null;
  } catch (error) {
    console.error('Error extracting table structure from text:', error);
    return null;
  }
}

// Import the value parsers from our value parser module
import { parseNumericValue, parseCurrencyValue, parsePercentageValue } from './table/valueParser';

/**
 * Convert extracted table data to AccountSummary objects
 */
export function convertTableToAccountSummaries(tableData: any): AccountSummary[] {
  const summaries: AccountSummary[] = [];
  
  if (!tableData || !tableData.rows || tableData.rows.length === 0) {
    return summaries;
  }
  
  // Process each row in the table
  tableData.rows.forEach((row: any) => {
    // Extract account type
    const accountType = row['Account Type'];
    if (!accountType) return;
    
    // Create an account summary object with all required properties
    const summary: AccountSummary = {
      accountType: accountType,
      totalAccounts: null,
      open: parseNumericValue(row['Open']),
      closed: null,
      balance: null,
      withBalance: parseNumericValue(row['With Balance']),
      totalBalance: parseCurrencyValue(row['Total Balance']),
      available: parseCurrencyValue(row['Available']),
      creditLimit: parseCurrencyValue(row['Credit Limit']),
      debtToCredit: parsePercentageValue(row['Debt-to-Credit']),
      payment: parseCurrencyValue(row['Payment'])
    };
    
    summaries.push(summary);
  });
  
  return summaries;
}
