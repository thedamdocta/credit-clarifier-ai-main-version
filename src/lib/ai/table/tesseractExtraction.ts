
import Tesseract from 'tesseract.js';
import { toast } from "sonner";
import { ExtractedTableData } from './types';
import { parsingLogger } from '@/utils/parsingLogger';

/**
 * Enhanced table detection and extraction using Tesseract.js
 * With improved handling for credit report tables
 */
export async function extractTableWithTesseract(imageUrl: string): Promise<ExtractedTableData | null> {
  try {
    console.log('Starting Tesseract table extraction from image');
    
    // Handle empty image URL case
    if (!imageUrl) {
      console.error('No image URL provided for Tesseract extraction');
      return null;
    }
    
    // Validate image URL format
    if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/') && !imageUrl.startsWith('data:')) {
      console.error('Invalid image URL format');
      return null;
    }
    
    // Add error handling for image loading
    const image = new Image();
    image.crossOrigin = "anonymous";
    
    // Wrap image loading in a promise
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => {
        console.error('Failed to load image for Tesseract');
        reject(new Error('Failed to load image'));
      };
      image.src = imageUrl;
    }).catch(err => {
      console.error('Image loading error:', err);
      throw new Error('Failed to load image');
    });
    
    // Initialize Tesseract with optimized settings for credit report tables
    const worker = await Tesseract.createWorker({
      logger: m => console.log(`Tesseract progress: ${m.progress} - ${m.status}`),
    });
    
    // Configure Tesseract for better table detection
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Set optimized parameters specifically for credit report tables
    // Removed invalid property 'tessedit_ocr_engine_mode'
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Auto detect segmentation mode
      preserve_interword_spaces: '1', // Preserve spaces between words
      tessjs_create_hocr: '1', // Create HOCR output for better structure
      tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$,.%- ', // Limit characters to improve accuracy
    });
    
    // Process the image
    let result;
    try {
      // First attempt with direct URL
      result = await worker.recognize(imageUrl);
      console.log('Recognition successful with URL');
    } catch (urlError) {
      console.warn('Failed to recognize with URL, trying with Image object:', urlError);
      try {
        // Second attempt with Image object
        result = await worker.recognize(image);
        console.log('Recognition successful with Image object');
      } catch (imgError) {
        console.error('Both recognition attempts failed:', imgError);
        await worker.terminate();
        throw imgError;
      }
    }
    
    console.log('Tesseract confidence:', result.data.confidence);
    console.log('Tesseract recognized text sample:', result.data.text.substring(0, 200) + '...');
    
    // Store the full recognized text for later pattern matching
    const fullText = result.data.text;
    
    // Extract tabular data using Tesseract's block structure detection
    const tableData = extractTableFromOCRResult(result.data);
    if (tableData) {
      tableData.text = fullText;
    }
    
    await worker.terminate();
    return tableData;
  } catch (error) {
    console.error('Error in Tesseract table extraction:', error);
    parsingLogger.logEvent('Tesseract extraction error', { error: String(error) });
    return null;
  }
}

/**
 * Extract data rows from the detected table
 * Enhanced to better detect total row and handle credit report formats
 */
function extractDataRows(lines: Tesseract.Line[], startIndex: number, columnBoundaries: number[]): string[][] {
  const dataRows: string[][] = [];
  const accountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Process each line that could be a data row
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const lineText = line.text;
    
    // Check if this is an account type row we're interested in
    const matchingAccountType = accountTypes.find(type => 
      lineText.toLowerCase().includes(type.toLowerCase()));
      
    if (matchingAccountType) {
      // This is an account type row we want
      const rowData: string[] = Array(columnBoundaries.length).fill('');
      
      // First cell is the account type
      rowData[0] = matchingAccountType;
      
      // Special handling for total row - more aggressive extraction
      if (matchingAccountType.toLowerCase() === 'total') {
        console.log('Found total row:', lineText);
        
        // Extract all numeric values from the line
        const allNumbers = lineText.match(/\d+/g) || [];
        console.log('Total row numbers:', allNumbers);
        
        // Typical patterns: "Total 12 11 $220,505..."
        if (allNumbers.length >= 2) {
          // Usually the first two numbers are "open" and "with balance"
          rowData[1] = allNumbers[0]; // Open
          rowData[2] = allNumbers[1]; // With Balance
          
          // Look for dollar amounts
          const dollarAmounts = lineText.match(/\$[\d,]+/g) || [];
          if (dollarAmounts.length > 0) {
            // First dollar amount is usually total balance
            rowData[3] = dollarAmounts[0]; // Total Balance
            
            // If there are more dollar amounts, map them to the right columns
            if (dollarAmounts.length > 1) rowData[4] = dollarAmounts[1]; // Available
            if (dollarAmounts.length > 2) rowData[5] = dollarAmounts[2]; // Credit Limit
            if (dollarAmounts.length > 3) rowData[7] = dollarAmounts[3]; // Payment
          }
          
          // Look for percentage values
          const percentages = lineText.match(/(\d+\.?\d*)%/g);
          if (percentages && percentages.length > 0) {
            rowData[6] = percentages[0]; // Debt-to-Credit
          }
        }
      } else {
        // Extract values for each column - regular row handling
        line.words.forEach(word => {
          // Skip the account type word itself
          if (word.text.toLowerCase() === matchingAccountType.toLowerCase()) return;
          
          // Find which column this word belongs to
          const columnIndex = columnBoundaries.findIndex((boundary, i) => {
            const nextBoundary = i < columnBoundaries.length - 1 ? columnBoundaries[i + 1] : Number.MAX_VALUE;
            return word.bbox.x0 >= boundary && word.bbox.x0 < nextBoundary;
          });
          
          if (columnIndex > 0) { // Skip first column as we've already set it
            if (!rowData[columnIndex]) {
              rowData[columnIndex] = word.text;
            } else {
              rowData[columnIndex] += ' ' + word.text;
            }
          }
        });
      }
      
      // Clean values and handle empty cells
      const cleanedRow = rowData.map(cell => {
        const cleaned = cell.trim();
        // Handle zero values specially
        if (cleaned === '0' || cleaned === 'O' || cleaned === 'o') return '0';
        return cleaned || '';
      });
      
      dataRows.push(cleanedRow);
    }
  }
  
  // Ensure we have all required account types
  const existingTypes = new Set(dataRows.map(row => row[0]));
  
  accountTypes.forEach(type => {
    if (!existingTypes.has(type)) {
      // Add empty row for missing account type
      const emptyRow = Array(columnBoundaries.length).fill('');
      emptyRow[0] = type;
      dataRows.push(emptyRow);
    }
  });
  
  return dataRows;
}

/**
 * Create a default table structure when header detection fails
 */
function createDefaultTableStructure(lines: Tesseract.Line[]): ExtractedTableData | null {
  try {
    console.log('Creating default table structure');
    
    // Default headers for credit account tables
    const headers = [
      'Account Type', 'Open', 'With Balance', 'Total Balance',
      'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'
    ];
    
    // Try to find rows with account type keywords
    const accountTypes = ['revolving', 'mortgage', 'installment', 'other', 'total'];
    const dataRows: string[][] = [];
    
    lines.forEach(line => {
      const text = line.text.toLowerCase();
      const matchingType = accountTypes.find(type => text.includes(type));
      
      if (matchingType) {
        // Found a line with an account type keyword
        console.log(`Found line with account type "${matchingType}": ${line.text}`);
        
        // Create a data row with the account type and extract any numeric values
        const row = [matchingType.charAt(0).toUpperCase() + matchingType.slice(1)];
        
        // Extract numbers from the line
        const numberMatches = line.text.match(/\$?[\d,]+(\.\d+)?%?/g) || [];
        console.log(`Found ${numberMatches.length} number matches:`, numberMatches);
        
        // Fill the row with the extracted numbers, padding with empty strings if needed
        for (let i = 0; i < headers.length - 1; i++) {
          row.push(i < numberMatches.length ? numberMatches[i] : '');
        }
        
        dataRows.push(row);
      }
    });
    
    // If we found at least one data row, return the table structure
    if (dataRows.length > 0) {
      console.log('Created default table structure with', dataRows.length, 'rows');
      return {
        headers,
        rows: dataRows,
        confidence: 50 // Lower confidence for default structure
      };
    }
    
    console.log('Could not create default table structure, no account type lines found');
    return null;
  } catch (error) {
    console.error('Error creating default table structure:', error);
    return null;
  }
}

/**
 * Detect column boundaries by analyzing word positions
 */
function detectColumns(lines: Tesseract.Line[]): number[] {
  // Analyze word positions across multiple lines to detect column boundaries
  const positions: number[] = [];
  
  // Get words from the first few content lines (skip potential headers)
  const contentLines = lines.slice(0, Math.min(lines.length, 10));
  
  // Extract word start positions
  contentLines.forEach(line => {
    line.words.forEach(word => {
      positions.push(word.bbox.x0);
    });
  });
  
  // Sort positions
  positions.sort((a, b) => a - b);
  
  // Find clusters of positions (columns)
  const columnBoundaries: number[] = [];
  let currentCluster: number[] = [];
  let prevPosition = positions[0];
  
  positions.forEach(position => {
    if (position - prevPosition > 20) {
      // New column boundary found
      if (currentCluster.length > 0) {
        const avgPosition = currentCluster.reduce((sum, pos) => sum + pos, 0) / currentCluster.length;
        columnBoundaries.push(avgPosition);
      }
      currentCluster = [position];
    } else {
      currentCluster.push(position);
    }
    prevPosition = position;
  });
  
  // Add the last cluster
  if (currentCluster.length > 0) {
    const avgPosition = currentCluster.reduce((sum, pos) => sum + pos, 0) / currentCluster.length;
    columnBoundaries.push(avgPosition);
  }
  
  return columnBoundaries;
}

/**
 * Find the header row by looking for specific header text patterns
 */
function findHeaderRow(lines: Tesseract.Line[]): number {
  const headerKeywords = ['account type', 'open', 'balance', 'credit limit', 'payment'];
  
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lineText = lines[i].text.toLowerCase();
    
    // Check if this line contains multiple header keywords
    const keywordsFound = headerKeywords.filter(keyword => lineText.includes(keyword));
    if (keywordsFound.length >= 3) {
      return i;
    }
  }
  
  return -1; // No header row found
}

/**
 * Extract headers from a detected header row
 */
function extractHeadersFromRow(headerLine: Tesseract.Line, columnBoundaries: number[]): string[] {
  const headers: string[] = [];
  
  // Default expected headers
  const defaultHeaders = [
    'Account Type', 'Open', 'With Balance', 'Total Balance',
    'Available', 'Credit Limit', 'Debt-to-Credit', 'Payment'
  ];
  
  // Extract text based on column positions
  headerLine.words.forEach(word => {
    // Find which column this word belongs to
    const columnIndex = columnBoundaries.findIndex((boundary, i) => {
      const nextBoundary = i < columnBoundaries.length - 1 ? columnBoundaries[i + 1] : Number.MAX_VALUE;
      return word.bbox.x0 >= boundary && word.bbox.x0 < nextBoundary;
    });
    
    // Add the word to the appropriate header
    if (columnIndex >= 0) {
      if (!headers[columnIndex]) {
        headers[columnIndex] = word.text;
      } else {
        headers[columnIndex] += ' ' + word.text;
      }
    }
  });
  
  // Clean up and normalize headers
  const cleanedHeaders = headers.map(header => header ? header.trim() : '');
  
  // If we didn't find enough headers, use defaults
  if (cleanedHeaders.filter(h => h).length < 4) {
    console.log('Not enough headers found, using defaults');
    return defaultHeaders;
  }
  
  return cleanedHeaders;
}

/**
 * Process Tesseract OCR result to extract tabular data
 * This function analyzes word positions to detect table structure
 * Enhanced to better handle credit report tables
 */
function extractTableFromOCRResult(ocrResult: Tesseract.Page): ExtractedTableData | null {
  try {
    // Log the raw OCR result for debugging
    console.log('Processing OCR result to extract table structure');
    
    // Get the lines content for positional analysis
    const lines = ocrResult.lines || [];
    if (lines.length === 0) {
      console.log('No lines found in OCR result');
      return null;
    }
    
    console.log(`Found ${lines.length} lines in OCR result`);
    
    // Detect column boundaries based on word positions
    const columns = detectColumns(lines);
    if (columns.length < 3) {
      console.log('Not enough columns detected, need at least 3');
      return null;
    }
    
    console.log(`Detected ${columns.length} columns at positions:`, columns);
    
    // Find header row
    const headerRowIndex = findHeaderRow(lines);
    if (headerRowIndex === -1) {
      console.log('Could not find header row, using default headers');
      return createDefaultTableStructure(lines);
    }
    
    console.log(`Found header row at index ${headerRowIndex}: "${lines[headerRowIndex].text}"`);
    
    // Extract headers and data rows based on positions
    const headers = extractHeadersFromRow(lines[headerRowIndex], columns);
    const dataRows = extractDataRows(lines, headerRowIndex + 1, columns);
    
    console.log('Extracted table structure with headers:', headers);
    console.log('Found data rows:', dataRows.length);
    
    // Special processing for the Total row
    const totalRowIndex = dataRows.findIndex(row => 
      row[0].toLowerCase().includes('total'));
      
    if (totalRowIndex >= 0) {
      console.log('Found Total row, applying special processing');
      // Look for Total row values in the raw text - this captures more values correctly
      const totalRowPattern = /total\s+(\d+)\s+(\d+)\s+\$?([\d,]+)\s+(-?\$[\d,]+)\s+\$?([\d,]+)\s+(\d+\.?\d*%?)\s+\$?([\d,]+)/i;
      
      // Search for the Total row in the full OCR text
      const totalMatch = ocrResult.text.match(totalRowPattern);
      
      if (totalMatch) {
        console.log('Found detailed Total row match in OCR text:', totalMatch);
        // Replace values in the Total row with the matched values
        dataRows[totalRowIndex] = [
          'Total',
          totalMatch[1] || dataRows[totalRowIndex][1], // Open
          totalMatch[2] || dataRows[totalRowIndex][2], // With Balance
          `$${totalMatch[3]}` || dataRows[totalRowIndex][3], // Total Balance
          totalMatch[4] || dataRows[totalRowIndex][4], // Available
          `$${totalMatch[5]}` || dataRows[totalRowIndex][5], // Credit Limit
          totalMatch[6] || dataRows[totalRowIndex][6], // Debt-to-Credit
          `$${totalMatch[7]}` || dataRows[totalRowIndex][7]  // Payment
        ];
      } else {
        // Try alternative pattern with less strict matching
        const simpleTotal = /total\s+(\d+)\s+(\d+)\s+\$?([\d,]+)/i;
        const simpleTotalMatch = ocrResult.text.match(simpleTotal);
        
        if (simpleTotalMatch) {
          console.log('Found simple Total row match in OCR text:', simpleTotalMatch);
          // Update just the matched fields
          dataRows[totalRowIndex][1] = simpleTotalMatch[1]; // Open
          dataRows[totalRowIndex][2] = simpleTotalMatch[2]; // With Balance  
          dataRows[totalRowIndex][3] = `$${simpleTotalMatch[3]}`; // Total Balance
          
          // Try to find negative Available value separately
          const negativeAvail = ocrResult.text.match(/total.*?(-\$[\d,]+)/i);
          if (negativeAvail) {
            dataRows[totalRowIndex][4] = negativeAvail[1]; // Available
          }
          
          // Try to find Credit Limit value separately  
          const creditLimit = ocrResult.text.match(/total.*?-\$[\d,]+.*?\$?([\d,]+)/i);
          if (creditLimit) {
            dataRows[totalRowIndex][5] = `$${creditLimit[1]}`; // Credit Limit
          }
          
          // Try to find payment value separately
          const payment = ocrResult.text.match(/total.*?\$([\d,]+).*?payment/i);
          if (payment) {
            dataRows[totalRowIndex][7] = `$${payment[1]}`; // Payment
          }
        }
      }
    }
    
    return {
      headers,
      rows: dataRows,
      confidence: ocrResult.confidence || 0,
      text: ocrResult.text // Add the raw text to enable pattern matching
    };
  } catch (error) {
    console.error('Error extracting table from OCR result:', error);
    return null;
  }
}
