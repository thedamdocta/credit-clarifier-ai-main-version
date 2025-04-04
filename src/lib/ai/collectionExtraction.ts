
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
    
    // Detect collection table format
    // Format 1: Table with columns (Date Reported, Agency, Account #, etc)
    // Format 2: Key-value pairs (like in the example image)
    const isKeyValuePairFormat = detectKeyValueFormat(tableData);
    
    if (isKeyValuePairFormat) {
      // Handle key-value pair format (like in the example image)
      return parseKeyValueCollectionFormat(tableData);
    }
    
    // Handle standard table format with columns
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
        dateAssigned: row.length > 6 ? row[6] : null,
        balanceDate: row.length > 7 ? row[7] : null,
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

// Detect if the table uses a key-value pair format rather than columns
function detectKeyValueFormat(tableData: ExtractedTableData): boolean {
  // In key-value format, we typically see rows with label-value pairs
  // rather than consistent columns across rows
  
  // Check for common key patterns in first column
  const keyPatterns = [
    /collection agency/i,
    /date reported/i,
    /original creditor/i,
    /account number/i,
    /date assigned/i,
    /status/i
  ];
  
  let keyValuePairCount = 0;
  const rowsToCheck = Math.min(tableData.rows.length, 10); // Check up to 10 rows
  
  for (let i = 0; i < rowsToCheck; i++) {
    const row = tableData.rows[i];
    if (!row || row.length < 2) continue;
    
    const potentialKey = row[0];
    if (!potentialKey) continue;
    
    for (const pattern of keyPatterns) {
      if (pattern.test(potentialKey)) {
        keyValuePairCount++;
        break;
      }
    }
  }
  
  // If we found several key patterns, it's likely a key-value format
  return keyValuePairCount >= 3;
}

// Parse a collection table that uses key-value pairs format
function parseKeyValueCollectionFormat(tableData: ExtractedTableData): Collection[] {
  const collections: Collection[] = [];
  let currentCollection: Partial<Collection> = {};
  let collectingContactInfo = false;
  let contactInfo: string[] = [];
  
  for (let i = 0; i < tableData.rows.length; i++) {
    const row = tableData.rows[i];
    if (!row || row.length === 0) continue;
    
    const key = row[0]?.trim().toLowerCase() || "";
    const value = row.length > 1 ? row[1]?.trim() || null : null;
    
    // If we find a new "Date Reported" key and we already have collection data,
    // save the current collection and start a new one
    if (key.includes("date reported") && Object.keys(currentCollection).length > 0) {
      if (contactInfo.length > 0 && !currentCollection.contact) {
        currentCollection.contact = contactInfo;
        contactInfo = [];
      }
      
      collections.push(currentCollection as Collection);
      currentCollection = {};
      collectingContactInfo = false;
    }
    
    // Special handling for Contact section
    if (key === "contact") {
      collectingContactInfo = true;
      contactInfo = [];
      if (value) contactInfo.push(value);
      continue;
    }
    
    // If we're collecting contact info and the row doesn't look like a key-value pair,
    // add it to contact info
    if (collectingContactInfo && !key.includes(":") && !key.match(/^(date|original|account|status|amount|creditor|balance)/i)) {
      if (key) contactInfo.push(key);
      if (value) contactInfo.push(value);
      continue;
    }
    
    // Process regular key-value pairs
    if (key.includes("date reported")) {
      currentCollection.dateReported = value;
    } else if (key.includes("collection agency")) {
      currentCollection.collectionAgency = value;
    } else if (key.includes("balance date")) {
      currentCollection.balanceDate = value;
    } else if (key.includes("original creditor")) {
      currentCollection.originalCreditorName = value;
    } else if (key.includes("account designator")) {
      currentCollection.accountDesignatorCode = value;
    } else if (key.includes("date assigned")) {
      currentCollection.dateAssigned = value;
    } else if (key.includes("account number")) {
      currentCollection.accountNumber = value;
    } else if (key.includes("original amount")) {
      currentCollection.originalAmountOwed = value;
    } else if (key.includes("creditor classification")) {
      currentCollection.creditorClassification = value;
    } else if (key.includes("amount") && !key.includes("original")) {
      currentCollection.amount = value;
    } else if (key.includes("last payment")) {
      currentCollection.lastPaymentDate = value;
    } else if (key.includes("status date")) {
      currentCollection.statusDate = value;
    } else if (key.includes("date of first delinquency")) {
      currentCollection.dateOfFirstDelinquency = value;
    } else if (key === "status") {
      currentCollection.status = value;
    } else if (key.includes("comment")) {
      if (!currentCollection.comments) currentCollection.comments = [];
      if (value) currentCollection.comments.push(value);
    }
  }
  
  // Add the last collection if we have one
  if (Object.keys(currentCollection).length > 0) {
    if (contactInfo.length > 0 && !currentCollection.contact) {
      currentCollection.contact = contactInfo;
    }
    
    // Initialize empty arrays if they don't exist
    if (!currentCollection.comments) currentCollection.comments = [];
    if (!currentCollection.contact) currentCollection.contact = [];
    
    collections.push(currentCollection as Collection);
  }
  
  return collections;
}

// Convert collections data from parsed report text
export const convertToCollections = (text: string): Collection[] => {
  // Use the equifaxCollections parser for text-based extraction
  return convertToCollection(text);
};
