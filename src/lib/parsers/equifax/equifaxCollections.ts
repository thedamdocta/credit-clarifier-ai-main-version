
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
    
    // Find collections section in the text using expanded patterns
    // This pattern looks for both numbered headers (like "10. Collections") and regular headers
    const collectionsRegexPatterns = [
      // Numbered section header pattern (e.g., "10. Collections")
      /\d+\.\s*Collections[\s\S]*?(?:(?=\d+\.\s*[A-Z][a-z]+)|$)/i,
      
      // Regular collections section pattern
      /COLLECTIONS?(?:\s+ACCOUNTS?)?(?:\s+INFORMATION)?[^\n]*\n([\s\S]*?)(?:(?:PUBLIC\s+RECORDS)|(?:CREDIT\s+INQUIRIES)|(?:PERSONAL\s+STATEMENT)|$)/i,
      
      // Alternative format with description paragraph
      /Collections[\s\S]*?Collections are accounts with[\s\S]*?(?:(?=\d+\.\s*[A-Z][a-z]+)|$)/i
    ];
    
    let collectionsText = "";
    
    // Try each pattern until we find a match
    for (const pattern of collectionsRegexPatterns) {
      const match = text.match(pattern);
      if (match && match[0]) {
        collectionsText = match[0];
        console.log("Found collections section using pattern:", pattern);
        break;
      }
    }
    
    if (!collectionsText) {
      console.log("No collections section found in text");
      return [];
    }
    
    console.log("Found collections section:", collectionsText.substring(0, 200) + "...");
    
    // Look for collection accounts in the text - multiple formats
    // This covers both table-based and key-value pair formats
    const accountPatternsToTry = [
      // Format with "Date Reported" header followed by indented collection data
      /Date\s+Reported\s*:\s*([^\n]+)(?:\n(?!Date\s+Reported)[^\n]*)*(?=\n\s*(?:Date\s+Reported|$))/gi,
      
      // Format with "Collection Agency" header
      /Collection\s+Agency\s*:\s*([^\n]+)(?:\n(?!Collection\s+Agency)[^\n]*)*(?=\n\s*(?:Collection\s+Agency|$))/gi,
      
      // Format with field-value pairs
      /((?:Collection Agency|Date Reported|Original Creditor|Date Assigned|Amount|Status)[^\n]*(?:\n(?!Collection Agency|Date Reported)[^\n]*)*)+/gi
    ];
    
    let accountMatches = null;
    
    // Try each pattern until we find matches
    for (const pattern of accountPatternsToTry) {
      accountMatches = collectionsText.match(pattern);
      if (accountMatches && accountMatches.length > 0) {
        console.log(`Found ${accountMatches.length} collection accounts using pattern:`, pattern);
        break;
      }
    }
    
    if (!accountMatches) {
      console.log("No collection accounts found in text");
      return [];
    }
    
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
      
      // Filter out empty collections
      const hasRequiredFields = 
        collection.collectionAgency || 
        collection.originalCreditorName || 
        collection.amount;
      
      if (hasRequiredFields) {
        collections.push(collection);
      }
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
  // Look for dedicated Comments section or text after status
  const commentsRegex = /Comments?:\s*([^\n]+)/gi;
  const comments: string[] = [];
  
  let match;
  while ((match = commentsRegex.exec(text)) !== null) {
    if (match[1] && match[1].trim()) {
      comments.push(match[1].trim());
    }
  }
  
  // If no dedicated Comments section, try to find any text after status that might be comments
  if (comments.length === 0) {
    const statusMatch = text.match(/Status:\s*([^\n]+)(?:\n(.+))?/i);
    if (statusMatch && statusMatch[2] && !statusMatch[2].includes(':')) {
      comments.push(statusMatch[2].trim());
    }
  }
  
  return comments;
};

/**
 * Extract contact information from collection account text
 */
const extractContact = (text: string): string[] => {
  // First try to find a dedicated Contact section
  const contactSectionMatch = text.match(/Contact\s*(?:\n|:)([\s\S]*?)(?=\n\s*(?:Comments|$))/i);
  
  if (contactSectionMatch && contactSectionMatch[1]) {
    // Split the contact section by lines and filter out empty lines
    return contactSectionMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.includes('Contact:'));
  }
  
  // If no dedicated section, look for contact information patterns
  const contactRegex = /(?:Contact|Phone|Address|Phone Number):\s*([^\n]+)/gi;
  const contacts: string[] = [];
  
  let match;
  while ((match = contactRegex.exec(text)) !== null) {
    if (match[1] && match[1].trim()) {
      contacts.push(match[1].trim());
    }
  }
  
  // Try to extract address patterns if no other contact info found
  if (contacts.length === 0) {
    // Look for address patterns (like PO Box, street names, city+state+zip)
    const addressRegex = /(\d+\s+[A-Za-z]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Pkwy|Parkway)\.?|P\.?O\.?\s+Box\s+\d+|[A-Za-z]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/g;
    
    while ((match = addressRegex.exec(text)) !== null) {
      if (match[1] && match[1].trim()) {
        contacts.push(match[1].trim());
      }
    }
    
    // Look for phone number patterns
    const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    
    while ((match = phoneRegex.exec(text)) !== null) {
      if (match[0] && match[0].trim()) {
        contacts.push(match[0].trim());
      }
    }
  }
  
  return contacts;
};
