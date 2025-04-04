
import { Collection } from "../../types/creditReport";

/**
 * Converts raw text from an Equifax report to collection objects
 * @param text The raw text from the Equifax credit report
 * @returns Array of Collection objects
 */
export const convertToCollection = (text: string): Collection[] => {
  try {
    console.log("Converting text to collections data");
    const collections: Collection[] = [];
    
    // Find collections section in the text
    const collectionsRegex = /COLLECTIONS?(?:\s+ACCOUNTS?)?(?:\s+INFORMATION)?[^\n]*\n([\s\S]*?)(?:(?:PUBLIC\s+RECORDS)|(?:CREDIT\s+INQUIRIES)|(?:PERSONAL\s+STATEMENT)|$)/i;
    const collectionsMatch = text.match(collectionsRegex);
    
    if (!collectionsMatch || !collectionsMatch[1]) {
      console.log("No collections section found in text");
      return [];
    }
    
    const collectionsText = collectionsMatch[1];
    console.log("Found collections section:", collectionsText.substring(0, 200) + "...");
    
    // Look for collection accounts in the text
    const accountsRegex = /(?:Collection\s+Agency|Collection\s+Account)[^\n]*(?:\n(?!Collection\s+Agency|Collection\s+Account)[^\n]*)*(?=\n|$)/gi;
    const accountMatches = collectionsText.match(accountsRegex);
    
    if (!accountMatches) {
      console.log("No collection accounts found in text");
      return [];
    }
    
    console.log(`Found ${accountMatches.length} potential collection accounts`);
    
    // Process each collection account
    for (const accountText of accountMatches) {
      const collection: Collection = {
        dateReported: extractValue(accountText, /(?:Date\s+Reported|Report\s+Date):\s*([^\n]+)/i),
        collectionAgency: extractValue(accountText, /(?:Collection\s+Agency|Creditor\s+Name):\s*([^\n]+)/i),
        balanceDate: extractValue(accountText, /Balance\s+(?:as\s+of|Date):\s*([^\n]+)/i),
        originalCreditorName: extractValue(accountText, /Original\s+Creditor(?:\s+Name)?:\s*([^\n]+)/i),
        accountDesignatorCode: extractValue(accountText, /Account\s+Designator(?:\s+Code)?:\s*([^\n]+)/i),
        dateAssigned: extractValue(accountText, /(?:Date\s+Assigned|Assigned\s+Date):\s*([^\n]+)/i),
        accountNumber: extractValue(accountText, /Account\s+(?:Number|#):\s*([^\n]+)/i),
        originalAmountOwed: extractValue(accountText, /Original\s+Amount(?:\s+Owed)?:\s*([^\n]+)/i),
        creditorClassification: extractValue(accountText, /Creditor\s+Classification:\s*([^\n]+)/i),
        amount: extractValue(accountText, /(?:Balance|Amount(?:\s+Owed)?):\s*([^\n]+)/i),
        lastPaymentDate: extractValue(accountText, /Last\s+Payment(?:\s+Date)?:\s*([^\n]+)/i),
        statusDate: extractValue(accountText, /Status\s+Date:\s*([^\n]+)/i),
        dateOfFirstDelinquency: extractValue(accountText, /Date\s+of\s+First\s+Delinquency:\s*([^\n]+)/i),
        status: extractValue(accountText, /Status:\s*([^\n]+)/i),
        comments: extractComments(accountText),
        contact: extractContact(accountText)
      };
      
      collections.push(collection);
    }
    
    console.log(`Successfully extracted ${collections.length} collection accounts`);
    return collections;
  } catch (error) {
    console.error("Error converting text to collections:", error);
    return [];
  }
};

/**
 * Helper function to extract a value using a regex pattern
 */
const extractValue = (text: string, pattern: RegExp): string | null => {
  const match = text.match(pattern);
  return match && match[1] ? match[1].trim() : null;
};

/**
 * Extract comments from collection account text
 */
const extractComments = (text: string): string[] => {
  const commentsRegex = /Comments?:\s*([^\n]+)/gi;
  const comments: string[] = [];
  
  let match;
  while ((match = commentsRegex.exec(text)) !== null) {
    if (match[1] && match[1].trim()) {
      comments.push(match[1].trim());
    }
  }
  
  return comments;
};

/**
 * Extract contact information from collection account text
 */
const extractContact = (text: string): string[] => {
  const contactRegex = /(?:Contact|Phone|Address):\s*([^\n]+)/gi;
  const contacts: string[] = [];
  
  let match;
  while ((match = contactRegex.exec(text)) !== null) {
    if (match[1] && match[1].trim()) {
      contacts.push(match[1].trim());
    }
  }
  
  return contacts;
};
