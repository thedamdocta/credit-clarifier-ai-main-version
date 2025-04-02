import { ExtractedTableData, ExtractedTable, FormattedTableData } from './types';
import { parseNumericValue, parseCurrencyValue, parsePercentageValue, parseCellValue } from './valueParser';

/**
 * Format extracted table data for display
 * Enhanced with specific credit report pattern recognition
 */
export function formatTableData(tableData: ExtractedTableData): FormattedTableData {
  if (!tableData || !tableData.headers || !tableData.rows) {
    return { headers: [], rows: [] };
  }
  
  const headers = tableData.headers.map(header => header.trim());
  const rows = tableData.rows.map(row => {
    const rowObject: Record<string, string> = {};
    
    // First determine the account type which affects how we process other cells
    const accountTypeIndex = headers.findIndex(header => 
      header.toLowerCase().includes('account') && header.toLowerCase().includes('type'));
    const accountType = accountTypeIndex >= 0 ? row[accountTypeIndex]?.trim() : '';
    
    headers.forEach((header, index) => {
      // Get raw value from the cell
      const rawValue = row[index]?.trim() || '';
      
      // For empty or not provided values, use "x" instead of formatting zeros
      if (!rawValue || rawValue === '' || rawValue === ',' || rawValue === '.') {
        rowObject[header] = "x";
      } 
      // Special handling for zeros - we want to keep actual zeros only for specific columns in Revolving
      else if (rawValue === '0' || rawValue === '$0') {
        // For Revolving account type, keep zeros for open and withBalance
        if (accountType.toLowerCase() === 'revolving' && 
            (getHeaderKey(header) === 'open' || getHeaderKey(header) === 'withBalance')) {
          rowObject[header] = "0";
        }
        // For all other account types or columns, display "x" for zeros
        else {
          rowObject[header] = "x";
        }
      }
      else {
        // Process each cell individually based on its content and column type
        const headerKey = getHeaderKey(header);
        
        if (headerKey === 'open' || headerKey === 'withBalance') {
          // Count columns - process numeric values
          rowObject[header] = parseNumericValue(rawValue) || "x";
        } 
        else if (headerKey === 'totalBalance' || headerKey === 'available' || 
                headerKey === 'creditLimit' || headerKey === 'payment') {
          // Money columns - process currency values
          rowObject[header] = parseCurrencyValue(rawValue) || "x";
        }
        else if (headerKey === 'debtToCredit') {
          // Percentage column - process percentage values
          rowObject[header] = parsePercentageValue(rawValue) || "x";
        }
        else {
          // Other columns - use as is or "x" if empty
          rowObject[header] = rawValue || "x";
        }
      }
    });
    
    return rowObject;
  });
  
  return { headers, rows };
}

/**
 * Helper function to check if a string contains negative value indicators
 */
function containsNegativeIndicator(value: string): boolean {
  return /[-−–—]/.test(value) || value.includes('-') || value.includes('−') || 
         value.includes('–') || value.includes('—');
}

/**
 * Get normalized header key for known value lookup
 */
function getHeaderKey(header: string): string {
  const lowerHeader = header.toLowerCase();
  if (lowerHeader.includes('open')) return 'open';
  if (lowerHeader.includes('with balance')) return 'withBalance';
  if (lowerHeader.includes('total balance')) return 'totalBalance';
  if (lowerHeader.includes('available')) return 'available';
  if (lowerHeader.includes('credit limit')) return 'creditLimit';
  if (lowerHeader.includes('debt-to-credit')) return 'debtToCredit';
  if (lowerHeader.includes('payment')) return 'payment';
  return 'unknown';
}

/**
 * Convert table data to CSV format
 */
export function tableToCSV(tableData: ExtractedTableData): string {
  if (!tableData || !tableData.headers || !tableData.rows) {
    return '';
  }
  
  const headers = tableData.headers.join(',');
  const rows = tableData.rows.map(row => row.join(','));
  return [headers, ...rows].join('\n');
}

/**
 * Format table data for display in a specific format
 * Enhanced with cell-by-cell processing and pattern recognition
 */
export function formatTableForDisplay(tableData: ExtractedTable): FormattedTableData {
  const headers = tableData.headers;
  const rows = tableData.rows.map(row => {
    const formattedRow: Record<string, string> = {};
    const accountType = row['Account Type']?.toLowerCase() || '';
    
    // Process each cell individually
    headers.forEach(header => {
      const rawValue = row[header];
      const headerKey = getHeaderKey(header);
      
      // Convert rawValue to string for consistent comparison
      const rawValueStr = String(rawValue || '');
      
      // For empty values, show "x"
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        formattedRow[header] = "x";
        return;
      }
      
      // For zero values - we ONLY keep zeros for open and withBalance in Revolving
      // All other zeros should be "x" including Mortgage and Other rows
      if (rawValueStr === '0' || rawValueStr === '$0') {
        // ONLY Revolving should show "0" for Open and WithBalance
        if (accountType === 'revolving' && (headerKey === 'open' || headerKey === 'withBalance')) {
          formattedRow[header] = "0";
        } else {
          // For all other cases, show zeros as "x"
          formattedRow[header] = "x";
        }
        return;
      }
      
      // For actual values, format them properly by column type
      if (headerKey === 'open' || headerKey === 'withBalance') {
        // Only Revolving should keep "0" values, all other account types should show "x" for 0
        if (rawValueStr === '0' && accountType !== 'revolving') {
          formattedRow[header] = "x";
        } else {
          formattedRow[header] = parseNumericValue(rawValueStr) || "x";
        }
      }
      else if (headerKey === 'totalBalance' || headerKey === 'available' || 
              headerKey === 'creditLimit' || headerKey === 'payment') {
        formattedRow[header] = parseCurrencyValue(rawValueStr) || "x";
      }
      else if (headerKey === 'debtToCredit') {
        formattedRow[header] = parsePercentageValue(rawValueStr) || "x";
      }
      else {
        formattedRow[header] = rawValueStr;
      }
    });
    
    return formattedRow;
  });
  
  return { headers, rows };
}
