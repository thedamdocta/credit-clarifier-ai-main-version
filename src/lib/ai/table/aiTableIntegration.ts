
import { processTableCellWithAI, batchProcessCells, CellType } from './aiCellProcessor';
import { ExtractedTable } from './types';

/**
 * Process an entire table with AI cell-by-cell
 * This enhances the accuracy of OCR'd table data
 */
export async function enhanceTableWithAI(tableData: ExtractedTable): Promise<ExtractedTable> {
  if (!tableData || !tableData.rows || tableData.rows.length === 0) {
    return tableData;
  }
  
  console.log('Enhancing table data with AI processing...');
  
  try {
    // Create a deep copy of the table to avoid mutations
    const enhancedTable: ExtractedTable = {
      headers: [...tableData.headers],
      rows: []
    };
    
    // Process each row
    for (const row of tableData.rows) {
      const enhancedRow: Record<string, string> = {};
      const cellsToProcess: Array<{
        key: string;
        value: string | null;
        type: CellType;
        columnName: string;
      }> = [];
      
      // Prepare the batch of cells for this row
      for (const header of tableData.headers) {
        const rawValue = row[header];
        const cellType = determineCellType(header);
        
        cellsToProcess.push({
          key: header,
          value: rawValue,
          type: cellType,
          columnName: header
        });
      }
      
      // Process all cells in this row in parallel
      const batchResults = await batchProcessCells(
        cellsToProcess.map(cell => ({
          value: cell.value,
          type: cell.type,
          columnName: cell.columnName
        }))
      );
      
      // Assign the AI-processed values back to the row
      cellsToProcess.forEach((cell, index) => {
        enhancedRow[cell.key] = batchResults[index].value;
      });
      
      enhancedTable.rows.push(enhancedRow);
    }
    
    console.log('AI enhancement complete for table with', enhancedTable.rows.length, 'rows');
    return enhancedTable;
  } catch (error) {
    console.error('Error enhancing table with AI:', error);
    return tableData; // Return original data on error
  }
}

/**
 * Determine cell type based on column header
 */
function determineCellType(header: string): CellType {
  const headerLower = header.toLowerCase();
  
  if (headerLower.includes('open') || headerLower.includes('with balance')) {
    return 'numeric';
  } else if (
    headerLower.includes('balance') || 
    headerLower.includes('available') || 
    headerLower.includes('credit limit') || 
    headerLower.includes('payment')
  ) {
    return 'currency';
  } else if (headerLower.includes('debt') || headerLower.includes('credit')) {
    return 'percentage';
  } else {
    return 'text';
  }
}

/**
 * Integration function to enhance the account summary extraction process
 * with AI cell processing
 */
export async function enhanceAccountSummariesWithAI(accountSummaries: any[]): Promise<any[]> {
  if (!accountSummaries || accountSummaries.length === 0) {
    return accountSummaries;
  }
  
  try {
    console.log('Enhancing account summaries with AI...');
    const enhancedSummaries = [];
    
    for (const summary of accountSummaries) {
      const enhancedSummary = { ...summary };
      
      // Process the key numeric fields with AI
      if (summary.open) {
        const openResult = await processTableCellWithAI(
          summary.open, 
          'numeric',
          'Open'
        );
        if (openResult.processed && openResult.confidence > 0.7) {
          enhancedSummary.open = openResult.value;
        }
      }
      
      if (summary.withBalance) {
        const withBalanceResult = await processTableCellWithAI(
          summary.withBalance, 
          'numeric',
          'With Balance'
        );
        if (withBalanceResult.processed && withBalanceResult.confidence > 0.7) {
          enhancedSummary.withBalance = withBalanceResult.value;
        }
      }
      
      if (summary.totalBalance) {
        const totalBalanceResult = await processTableCellWithAI(
          summary.totalBalance, 
          'currency',
          'Total Balance'
        );
        if (totalBalanceResult.processed && totalBalanceResult.confidence > 0.7) {
          enhancedSummary.totalBalance = totalBalanceResult.value;
        }
      }
      
      // Process other fields as needed
      // Add more fields as necessary
      
      enhancedSummaries.push(enhancedSummary);
    }
    
    return enhancedSummaries;
  } catch (error) {
    console.error('Error enhancing account summaries with AI:', error);
    return accountSummaries; // Return original data on error
  }
}
