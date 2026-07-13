import Tesseract from 'tesseract.js';
import { toast } from "sonner";
import { ExtractedTableData } from './types';
import { calculateCreditAccountsTableScore } from '../tableDetection';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

/**
 * Enhanced table detection and extraction using Tesseract.js
 * This complements the Hugging Face approach for better table structure recognition
 * with a focus on finding and extracting Credit Accounts tables
 */
export async function extractTableWithTesseract(
  imageUrl: string,
  targetTableName: string = "Credit Accounts"
): Promise<ExtractedTableData | null> {
  try {
    devDiagnostics.log(`Starting Tesseract extraction for "${targetTableName}" table from image:`, imageUrl);
    
    // Handle empty image URL case
    if (!imageUrl) {
      devDiagnostics.error('No image URL provided for Tesseract extraction');
      return null;
    }
    
    // Validate image URL format
    if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/') && !imageUrl.startsWith('data:')) {
      devDiagnostics.error('Invalid image URL format:', imageUrl);
      return null;
    }
    
    // Add error handling for image loading
    const image = new Image();
    image.crossOrigin = "anonymous";
    
    // Wrap image loading in a promise
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => {
        devDiagnostics.error('Failed to load image for Tesseract');
        reject(new Error('Failed to load image'));
      };
      image.src = imageUrl;
    }).catch(err => {
      devDiagnostics.error('Image loading error:', err);
      throw new Error('Failed to load image');
    });
    
    // Initialize Tesseract with optimized settings for table structure detection
    const worker = await Tesseract.createWorker({
      logger: m => devDiagnostics.log(`Tesseract progress: ${m.progress} - ${m.status}`),
    });
    
    // Configure Tesseract for better table detection
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    // Set only supported parameters (removing the problematic tessedit_ocr_engine_mode)
    await worker.setParameters({
      preserve_interword_spaces: '1', // Preserve spaces between words
      tessjs_create_hocr: '1', // Create HOCR output for better structure understanding
      tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$,.%- ', // Limit characters to improve accuracy
    });
    
    // Try both URL and Image object for best compatibility
    let result;
    try {
      // First attempt with URL
      result = await worker.recognize(imageUrl);
      devDiagnostics.log('Recognition successful with URL');
    } catch (urlError) {
      devDiagnostics.warn('Failed to recognize with URL, trying with Image object:', urlError);
      try {
        // Second attempt with Image object
        result = await worker.recognize(image);
        devDiagnostics.log('Recognition successful with Image object');
      } catch (imgError) {
        devDiagnostics.error('Both recognition attempts failed:', imgError);
        await worker.terminate();
        throw imgError;
      }
    }
    
    devDiagnostics.log('Tesseract confidence:', result.data.confidence);
    
    // Log a sample of the recognized text for debugging
    const previewText = result.data.text.substring(0, 200) + '...';
    devDiagnostics.log('Tesseract recognized text sample:', previewText);
    
    // Calculate score to determine if this is the Credit Accounts table
    const tableScore = calculateCreditAccountsTableScore(result.data.text);
    devDiagnostics.log(`Table match score for "${targetTableName}": ${tableScore.toFixed(2)}`);
    
    // Check specifically if the text contains credit account table keywords
    const textLower = result.data.text.toLowerCase();
    const hasTableKeywords = 
      (textLower.includes('revolving') || textLower.includes('mortgage') || textLower.includes('installment')) && 
      (textLower.includes('balance') || textLower.includes('credit limit') || textLower.includes('payment'));
    
    // Determine if this is likely the correct table
    const isLikelyTargetTable = tableScore > 0.5 || (hasTableKeywords && textLower.includes('account type'));
    
    if (!isLikelyTargetTable) {
      devDiagnostics.log(`This is likely NOT the "${targetTableName}" table (score: ${tableScore.toFixed(2)})`);
      
      // If it's clearly not the target table, return null to try with another image
      if (tableScore < 0.3) {
        devDiagnostics.log(`Rejecting image as unlikely to contain "${targetTableName}" table`);
        await worker.terminate();
        return null;
      }
    } else {
      devDiagnostics.log(`This is likely the "${targetTableName}" table (score: ${tableScore.toFixed(2)})`);
    }
    
    // Extract tabular data using Tesseract's block structure detection
    const tableData = extractTableFromOCRResult(result.data);
    
    // Add the table match score to help with ranking multiple extractions
    if (tableData) {
      tableData.matchScore = tableScore;
      tableData.isTargetTable = isLikelyTargetTable;
      tableData.text = result.data.text; // Add the recognized text for reference
    }
    
    await worker.terminate();
    return tableData;
  } catch (error) {
    devDiagnostics.error('Error in Tesseract table extraction:', error);
    return null;
  }
}

/**
 * Process Tesseract OCR result to extract tabular data
 * This function analyzes word positions to detect table structure
 */
function extractTableFromOCRResult(ocrResult: Tesseract.Page): ExtractedTableData | null {
  try {
    // Log the raw OCR result for debugging
    devDiagnostics.log('Processing OCR result to extract table structure');
    
    // Get the lines content for positional analysis
    const lines = ocrResult.lines || [];
    if (lines.length === 0) {
      devDiagnostics.log('No lines found in OCR result');
      return null;
    }
    
    devDiagnostics.log(`Found ${lines.length} lines in OCR result`);
    
    // First try to find any line that looks like account table data
    const accountTypeRegex = /^(revolving|mortgage|installment|other|total)\s+\d+/i;
    const hasAccountTypeLines = lines.some(line => accountTypeRegex.test(line.text.trim()));
    
    if (!hasAccountTypeLines) {
      devDiagnostics.log('No lines matching account type pattern found');
      // Continue with column detection, we might still find a table structure
    } else {
      devDiagnostics.log('Found lines matching account type pattern');
    }
    
    // Detect column boundaries based on word positions
    const columns = detectColumns(lines);
    if (columns.length < 3) {
      devDiagnostics.log('Not enough columns detected, need at least 3');
      return createDefaultTableStructure(lines);
    }
    
    devDiagnostics.log(`Detected ${columns.length} columns at positions:`, columns);
    
    // Find header row
    const headerRowIndex = findHeaderRow(lines);
    if (headerRowIndex === -1) {
      devDiagnostics.log('Could not find header row, using default headers');
      return createDefaultTableStructure(lines);
    }
    
    devDiagnostics.log(`Found header row at index ${headerRowIndex}: "${lines[headerRowIndex].text}"`);
    
    // Extract headers and data rows based on positions
    const headers = extractHeadersFromRow(lines[headerRowIndex], columns);
    const dataRows = extractDataRows(lines, headerRowIndex + 1, columns);
    
    devDiagnostics.log('Extracted table structure with headers:', headers);
    devDiagnostics.log('Found data rows:', dataRows.length);
    
    // If no data rows were found but we have headers, still try to extract account type rows
    if (dataRows.length === 0) {
      devDiagnostics.log('No data rows found but headers exist, trying to extract account type rows directly');
      const accountTypeRows = extractAccountTypeRows(lines, headers);
      if (accountTypeRows.length > 0) {
        return {
          headers,
          rows: accountTypeRows,
          confidence: ocrResult.confidence || 0
        };
      }
    }
    
    // If we have headers and data rows, return them
    if (headers.length > 0 && dataRows.length > 0) {
      return {
        headers,
        rows: dataRows,
        confidence: ocrResult.confidence || 0
      };
    }
    
    // Fallback to default structure if extraction failed
    return createDefaultTableStructure(lines);
  } catch (error) {
    devDiagnostics.error('Error extracting table from OCR result:', error);
    return null;
  }
}

/**
 * Extract rows that match account types directly from lines
 */
function extractAccountTypeRows(lines: Tesseract.Line[], headers: string[]): string[][] {
  const accountTypes = ['revolving', 'mortgage', 'installment', 'other', 'total'];
  const rows: string[][] = [];
  
  lines.forEach(line => {
    const text = line.text.toLowerCase().trim();
    
    // Check if this line starts with an account type
    for (const type of accountTypes) {
      if (text.startsWith(type)) {
        // Extract numbers from the line
        const numbers = text.match(/\d+/g) || [];
        
        // Create a row starting with the capitalized account type
        const row = [type.charAt(0).toUpperCase() + type.slice(1)];
        
        // Add numbers to the row, matching the expected number of columns
        numbers.forEach((num, i) => {
          if (i < headers.length - 1) { // -1 because we've already added the account type
            row.push(num);
          }
        });
        
        // Fill remaining columns with empty strings
        while (row.length < headers.length) {
          row.push('');
        }
        
        rows.push(row);
        break; // Found a match for this line, move to next line
      }
    }
  });
  
  return rows;
}

/**
 * Create a default table structure when header detection fails
 */
function createDefaultTableStructure(lines: Tesseract.Line[]): ExtractedTableData | null {
  try {
    devDiagnostics.log('Creating default table structure');
    
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
        devDiagnostics.log(`Found line with account type "${matchingType}": ${line.text}`);
        
        // Create a data row with the account type and extract any numeric values
        const row = [matchingType.charAt(0).toUpperCase() + matchingType.slice(1)];
        
        // Extract numbers from the line
        const numberMatches = line.text.match(/\$?[\d,]+(\.\d+)?%?/g) || [];
        devDiagnostics.log(`Found ${numberMatches.length} number matches:`, numberMatches);
        
        // Fill the row with the extracted numbers, padding with empty strings if needed
        for (let i = 0; i < headers.length - 1; i++) {
          row.push(i < numberMatches.length ? numberMatches[i] : '');
        }
        
        dataRows.push(row);
      }
    });
    
    // If we found at least one data row, return the table structure
    if (dataRows.length > 0) {
      devDiagnostics.log('Created default table structure with', dataRows.length, 'rows');
      return {
        headers,
        rows: dataRows,
        confidence: 50 // Lower confidence for default structure
      };
    }
    
    devDiagnostics.log('Could not create default table structure, no account type lines found');
    return null;
  } catch (error) {
    devDiagnostics.error('Error creating default table structure:', error);
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
  // Enhanced header keywords to better identify the credit accounts table header
  const headerKeywords = [
    'account type', 'open', 'balance', 'credit limit', 'payment',
    'with balance', 'debt-to-credit', 'available'
  ];
  
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const lineText = lines[i].text.toLowerCase();
    
    // Check if this line contains multiple header keywords
    const keywordsFound = headerKeywords.filter(keyword => lineText.includes(keyword));
    if (keywordsFound.length >= 3) { // Need at least 3 header keywords
      return i;
    }
    
    // Alternative pattern: "account type" is a strong indicator when present
    if (lineText.includes('account type') && 
        (lineText.includes('open') || lineText.includes('balance'))) {
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
    devDiagnostics.log('Not enough headers found, using defaults');
    return defaultHeaders;
  }
  
  return cleanedHeaders.map(header => {
    // Map recognized headers to standard format
    const headerLower = header.toLowerCase();
    if (headerLower.includes('account') && headerLower.includes('type')) return 'Account Type';
    if (headerLower === 'open' || headerLower.includes('open')) return 'Open';
    if (headerLower.includes('with') && headerLower.includes('balance')) return 'With Balance';
    if (headerLower.includes('total') && headerLower.includes('balance')) return 'Total Balance';
    if (headerLower === 'available' || headerLower.includes('available')) return 'Available';
    if (headerLower.includes('credit') && headerLower.includes('limit')) return 'Credit Limit';
    if (headerLower.includes('debt') || headerLower.includes('debt-to-credit')) return 'Debt-to-Credit';
    if (headerLower === 'payment' || headerLower.includes('payment')) return 'Payment';
    return header; // If no match, keep original
  });
}

/**
 * Extract data rows from the detected table
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
      
      // Extract values for each column
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
