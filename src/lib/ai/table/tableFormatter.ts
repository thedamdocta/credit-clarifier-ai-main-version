
import { ExtractedTableData, ExtractedTable, FormattedTableData } from './types';

/**
 * Format extracted table data for display
 */
export function formatTableData(tableData: ExtractedTableData): FormattedTableData {
  if (!tableData || !tableData.headers || !tableData.rows) {
    return { headers: [], rows: [] };
  }
  
  const headers = tableData.headers.map(header => header.trim());
  const rows = tableData.rows.map(row => {
    const rowObject: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObject[header] = row[index]?.trim() || '';
    });
    return rowObject;
  });
  
  return { headers, rows };
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
 */
export function formatTableForDisplay(tableData: ExtractedTable): FormattedTableData {
  const headers = tableData.headers;
  const rows = tableData.rows;
  
  return { headers, rows: rows.map(row => ({ ...row })) };
}
