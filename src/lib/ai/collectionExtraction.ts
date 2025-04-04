
import { ExtractedTableData } from "./table/types";
import { Collection } from "../types/creditReport";
import { extractTableFromImage } from "./tableExtraction";
import { convertToCollection } from "../parsers/equifax/equifaxCollections";

// Extract collections data from image
export const extractCollectionsFromImage = async (imageUrl: string): Promise<Collection[]> => {
  try {
    console.log("Extracting collections data from image:", imageUrl);
    const tableData = await extractTableFromImage(imageUrl);
    
    if (!tableData || !tableData.rows || tableData.rows.length === 0) {
      console.error("No table data extracted from collections image");
      return [];
    }
    
    console.log("Successfully extracted collections table data:", tableData);
    return convertTableToCollections(tableData);
  } catch (error) {
    console.error("Error extracting collections from image:", error);
    return [];
  }
};

// Convert table data to Collection objects
export const convertTableToCollections = (tableData: ExtractedTableData): Collection[] => {
  try {
    const collections: Collection[] = [];
    
    // Skip header row if present
    const startRow = tableData.headers.length > 0 ? 1 : 0;
    
    for (let i = startRow; i < tableData.rows.length; i++) {
      const row = tableData.rows[i];
      
      // Skip empty rows
      if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        continue;
      }
      
      // Map table columns to collection properties
      // This mapping might need adjustment based on the actual table structure
      const collection: Collection = {
        dateReported: row[0] || null,
        collectionAgency: row[1] || null,
        accountNumber: row[2] || null,
        originalCreditorName: row[3] || null,
        amount: row[4] || null,
        status: row[5] || null,
        dateAssigned: null,
        balanceDate: null,
        accountDesignatorCode: null,
        originalAmountOwed: null,
        creditorClassification: null,
        lastPaymentDate: null,
        statusDate: null,
        dateOfFirstDelinquency: null,
        comments: [],
        contact: []
      };
      
      collections.push(collection);
    }
    
    return collections;
  } catch (error) {
    console.error("Error converting table to collections:", error);
    return [];
  }
};

// Convert collections data from parsed report text
export const convertToCollections = (text: string): Collection[] => {
  // Implement text-based extraction (fallback method)
  return convertToCollection(text);
};
