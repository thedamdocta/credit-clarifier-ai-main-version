
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
      
      // Only add non-empty collections
      if (collection.collectionAgency || collection.originalCreditorName || collection.amount) {
        collections.push(collection);
      }
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
  
  // If the tableData is just one big block of text in a single cell,
  // we need to try to parse it differently
  if (tableData.rows.length === 1 && tableData.rows[0].length === 1) {
    // The collection data is in one big text block
    const text = tableData.rows[0][0];
    if (text && text.length > 0) {
      const parsedCollections = parseCollectionTextBlock(text);
      return parsedCollections;
    }
  }
  
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
    
    // Only add if we have at least one identifying field
    if (currentCollection.collectionAgency || currentCollection.originalCreditorName || currentCollection.amount) {
      collections.push(currentCollection as Collection);
    }
  }
  
  return collections;
}

// Parse a single block of text that contains collection information
function parseCollectionTextBlock(text: string): Collection[] {
  const collections: Collection[] = [];
  const collection: Partial<Collection> = {
    comments: [],
    contact: []
  };
  
  // Common patterns from the collection text (based on the image example)
  const dateReportedMatch = text.match(/(?:Date Reported|Report Date)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (dateReportedMatch) collection.dateReported = dateReportedMatch[1].trim();
  
  const collectionAgencyMatch = text.match(/Collection Agency[:\s]+([^.]*)(?=Balance Date|Original Creditor|Account Des|$)/i);
  if (collectionAgencyMatch) collection.collectionAgency = collectionAgencyMatch[1].trim();
  
  const balanceDateMatch = text.match(/Balance Date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (balanceDateMatch) collection.balanceDate = balanceDateMatch[1].trim();
  
  const originalCreditorMatch = text.match(/Original Creditor[^:]*:[:\s]+([^.]*)(?=Account Des|Date Assigned|$)/i);
  if (originalCreditorMatch) collection.originalCreditorName = originalCreditorMatch[1].trim();
  
  const accountDesignatorMatch = text.match(/Account Designator Code[:\s]+([^.]*)(?=Date Assigned|Account Number|$)/i);
  if (accountDesignatorMatch) collection.accountDesignatorCode = accountDesignatorMatch[1].trim();
  
  const dateAssignedMatch = text.match(/Date Assigned[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (dateAssignedMatch) collection.dateAssigned = dateAssignedMatch[1].trim();
  
  const accountNumberMatch = text.match(/Account Number[:\s]+([^.]*)(?=Original Amount|$)/i);
  if (accountNumberMatch) collection.accountNumber = accountNumberMatch[1].trim();
  
  const originalAmountMatch = text.match(/Original Amount[:\s]+\$?([\d.,]+)/i);
  if (originalAmountMatch) collection.originalAmountOwed = '$' + originalAmountMatch[1].trim();
  
  const creditorClassificationMatch = text.match(/Creditor Classification[:\s]+([^.]*)(?=Amount|Last Payment|$)/i);
  if (creditorClassificationMatch) collection.creditorClassification = creditorClassificationMatch[1].trim();
  
  const amountMatch = text.match(/Amount[:\s]+\$?([\d.,]+)/i);
  if (amountMatch) collection.amount = '$' + amountMatch[1].trim();
  
  const lastPaymentMatch = text.match(/Last Payment Date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (lastPaymentMatch) collection.lastPaymentDate = lastPaymentMatch[1].trim();
  
  const statusDateMatch = text.match(/Status Date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (statusDateMatch) collection.statusDate = statusDateMatch[1].trim();
  
  const firstDelinquencyMatch = text.match(/Date of First Delinquency[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (firstDelinquencyMatch) collection.dateOfFirstDelinquency = firstDelinquencyMatch[1].trim();
  
  const statusMatch = text.match(/Status[:\s]+([^.]*)(?=Comments|Contact|$)/i);
  if (statusMatch) collection.status = statusMatch[1].trim();
  
  // Look for contact information
  const contactMatch = text.match(/Contact[:\s]+(.*?)(?=Comments|$)/is);
  if (contactMatch) {
    const contactText = contactMatch[1].trim();
    // Split contact info by lines and filter out empty ones
    collection.contact = contactText
      .split(/[\n\r]/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
  
  // Look for comments
  const commentsMatch = text.match(/Comments[:\s]+(.*?)(?=Contact|$)/is);
  if (commentsMatch) {
    const commentsText = commentsMatch[1].trim();
    // Split comments by lines and filter out empty ones
    collection.comments = commentsText
      .split(/[\n\r]/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
  
  // Only add if we have at least basic information
  if (collection.collectionAgency || collection.originalCreditorName || collection.amount) {
    collections.push(collection as Collection);
  }
  
  return collections;
}

// Convert collections data from parsed report text
export const convertToCollections = (text: string): Collection[] => {
  // Use the equifaxCollections parser for text-based extraction
  return convertToCollection(text);
};
