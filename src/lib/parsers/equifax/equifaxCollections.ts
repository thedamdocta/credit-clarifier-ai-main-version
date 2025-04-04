
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
      /Collections[\s\S]*?Collections are accounts with[\s\S]*?(?:(?=\d+\.\s*[A-Z][a-z]+)|$)/i,
      
      // Single line collections header followed by data
      /Collections\s*\n([\s\S]*?)(?:(?=\d+\.\s*[A-Z][a-z]+)|$)/i
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
      // Try broader search - look for lines containing "Collection Agency"
      const collectionAgencyMatch = text.match(/Collection Agency[^\n]*\n([\s\S]*?)(?:\n\s*\n|\n(?=\d+\.\s*[A-Z][a-z]+))/i);
      if (collectionAgencyMatch && collectionAgencyMatch[0]) {
        collectionsText = collectionAgencyMatch[0];
        console.log("Found collections through 'Collection Agency' mention");
      } else {
        // Try to find any mentions of collections accounts
        const collectionAccountsMatch = text.match(/(?:placed in collections|collection account|sent to collections)([^.]*\.[^.]*)/gi);
        if (collectionAccountsMatch && collectionAccountsMatch.length > 0) {
          collectionsText = collectionAccountsMatch.join("\n");
          console.log("Found collection mentions in text");
        } else {
          return [];
        }
      }
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
      /((?:Collection Agency|Date Reported|Original Creditor|Date Assigned|Amount|Status)[^\n]*(?:\n(?!Collection Agency|Date Reported)[^\n]*)*)+/gi,
      
      // Format with section headers followed by data blocks
      /COLLECTION[S]?\s+INFORMATION(?:\n(?!PUBLIC\s+RECORDS|INQUIRIES)[^\n]*)*(?=\n\s*(?:PUBLIC\s+RECORDS|INQUIRIES|$))/gi,
      
      // Look for any paragraph containing collection information
      /([^\n.]+(?:collection|collector|debt)(?:[^\n.]*)\.)/gi
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
    
    // If we didn't find matches with the specific patterns, try a more general approach
    if (!accountMatches || accountMatches.length === 0) {
      // Look for paragraphs that might contain collection info
      const paragraphPattern = /([^\n]+(?:collection|collector|debt)[^\n]+(?:\n(?![\n\d+\.])[^\n]+)*)/gi;
      accountMatches = collectionsText.match(paragraphPattern);
      console.log(`Found ${accountMatches?.length || 0} collection paragraphs using general pattern`);
    }
    
    if (!accountMatches || accountMatches.length === 0) {
      // As a last resort, split the collections text into chunks
      const chunks = collectionsText.split(/\n\s*\n/).filter(chunk => 
        chunk.length > 20 && 
        (chunk.toLowerCase().includes('collection') || 
         chunk.toLowerCase().includes('creditor') || 
         chunk.toLowerCase().includes('debt'))
      );
      
      if (chunks.length > 0) {
        accountMatches = chunks;
        console.log(`Created ${chunks.length} collection chunks from text`);
      } else {
        console.log("No collection accounts found in text");
        return [];
      }
    }
    
    // Process each collection account
    for (const accountText of accountMatches) {
      // Skip very short texts or ones that don't look like collection entries
      if (accountText.length < 20 || (!accountText.toLowerCase().includes('collection') && 
                                      !accountText.toLowerCase().includes('creditor') && 
                                      !accountText.toLowerCase().includes('debt'))) {
        continue;
      }
      
      const collection: Collection = {
        dateReported: extractValue(accountText, /(?:Date\s+Reported|Report\s+Date):\s*([^\n]+)/i) || 
                      extractValue(accountText, /(?:Reported|Reported\s+Date)[^\w]+([a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4})/i),
                      
        collectionAgency: extractValue(accountText, /(?:Collection\s+Agency|Creditor\s+Name|Collector):\s*([^\n]+)/i) || 
                          extractValue(accountText, /(?:placed|sent)[^\w]+(?:with|to)\s+([A-Z][A-Za-z\s]+)(?:\s+for\s+collection|\s+to\s+collect)/i),
                          
        balanceDate: extractValue(accountText, /Balance\s+(?:as\s+of|Date):\s*([^\n]+)/i),
        
        originalCreditorName: extractValue(accountText, /Original\s+Creditor(?:\s+Name)?:\s*([^\n]+)/i) || 
                             extractValue(accountText, /originally\s+(?:with|from)\s+([A-Z][A-Za-z\s]+)(?:,|\.|and)/i),
                             
        accountDesignatorCode: extractValue(accountText, /Account\s+Designator(?:\s+Code)?:\s*([^\n]+)/i),
        
        dateAssigned: extractValue(accountText, /(?:Date\s+Assigned|Assigned\s+Date):\s*([^\n]+)/i) || 
                     extractValue(accountText, /(?:assigned|placed)[^\w]+(?:on|in)\s+([a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4})/i),
                     
        accountNumber: extractValue(accountText, /Account\s+(?:Number|#):\s*([^\n]+)/i) || 
                      extractValue(accountText, /(?:account|acct)(?:[^\w]+|\s+)(?:no|number|#)[^\w:]*\s*([A-Za-z0-9*]+)/i),
                      
        originalAmountOwed: extractValue(accountText, /Original\s+Amount(?:\s+Owed)?:\s*([^\n]+)/i) || 
                           extractValue(accountText, /original(?:ly)?\s+(?:amount|balance)[^\w:]*\s*\$?\s*(\d[\d,.]+)/i),
                           
        creditorClassification: extractValue(accountText, /Creditor\s+Classification:\s*([^\n]+)/i),
        
        amount: extractValue(accountText, /(?:Balance|Amount(?:\s+Owed)?):\s*([^\n]+)/i) || 
               extractValue(accountText, /(?:current\s+balance|amount\s+due|owes)[^\w:]*\s*\$?\s*(\d[\d,.]+)/i) ||
               extractValue(accountText, /\$(\d[\d,.]+)/),
               
        lastPaymentDate: extractValue(accountText, /Last\s+Payment(?:\s+Date)?:\s*([^\n]+)/i) || 
                        extractValue(accountText, /last\s+paid[^\w]+(?:on|in)\s+([a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4})/i),
                        
        statusDate: extractValue(accountText, /Status\s+Date:\s*([^\n]+)/i),
        
        dateOfFirstDelinquency: extractValue(accountText, /Date\s+of\s+First\s+Delinquency:\s*([^\n]+)/i) || 
                               extractValue(accountText, /(?:first|initially)\s+(?:delinquent|past\s+due)[^\w]+(?:on|in)\s+([a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4})/i),
                               
        status: extractValue(accountText, /Status:\s*([^\n]+)/i) || 
               extractValue(accountText, /(?:account|collection)(?:\s+is|\s+status)?\s+([A-Za-z\s]+)(?:\.|\n|,)/i),
               
        comments: extractComments(accountText),
        contact: extractContact(accountText)
      };
      
      // Filter out empty collections
      const hasRequiredFields = 
        collection.collectionAgency || 
        collection.originalCreditorName || 
        collection.amount;
      
      // If we have a collection amount text but couldn't parse it as a formal amount field,
      // try to extract it from the general text
      if (!collection.amount && accountText.match(/\$\s*[\d,.]+/)) {
        const amountMatch = accountText.match(/\$\s*([\d,.]+)/);
        if (amountMatch && amountMatch[1]) {
          collection.amount = '$' + amountMatch[1].trim();
        }
      }
      
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
    
    // Look for entire sentences that might be comments
    const sentencePattern = /(?<=\.|\n)\s*([A-Z][^.!?]+[.!?])(?=\s|\n|$)/g;
    let sentenceMatch;
    while ((sentenceMatch = sentencePattern.exec(text)) !== null) {
      if (sentenceMatch[1] && 
          sentenceMatch[1].length > 15 && 
          !sentenceMatch[1].includes(':') && 
          (sentenceMatch[1].includes('collection') || 
           sentenceMatch[1].includes('creditor') ||
           sentenceMatch[1].includes('payment') ||
           sentenceMatch[1].includes('account'))) {
        comments.push(sentenceMatch[1].trim());
      }
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
