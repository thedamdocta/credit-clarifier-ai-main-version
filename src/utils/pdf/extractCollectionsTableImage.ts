
import { CreditReport } from "@/lib/types/creditReport";
import { getCurrentPDFData } from "./extractText";
import { convertPDFPageToImage } from "./pdfToImage";

// Store the extracted collections table image URL
let collectionsTableImageURL: string | null = null;

export const resetCollectionsTableImage = () => {
  collectionsTableImageURL = null;
};

export const extractCollectionsTableImage = async (report: CreditReport): Promise<string | null> => {
  try {
    // Return cached image if available
    if (collectionsTableImageURL) {
      console.log("Using cached collections table image");
      return collectionsTableImageURL;
    }
    
    console.log("Attempting to extract collections table image from PDF");
    
    // Get PDF data from current session
    const pdfData = getCurrentPDFData();
    if (!pdfData || !pdfData.pdfDocument) {
      console.error("No PDF document available for collections table extraction");
      return null;
    }
    
    // Expanded keywords to identify collections section in the report
    const collectionKeywords = [
      "collection account",
      "collection accounts",
      "accounts in collection",
      "collection information",
      "collections",
      "collection agency",
      "10. collections", // Format in the example image
      "collections are accounts with outstanding debt",
      "placed for collection",
      "placed with collection",
      "debt collector"
    ];
    
    // Search text for collections section
    const rawText = report.rawText || "";
    let collectionsPageNumber = -1;
    let collectionsHeaderIndex = -1;
    
    // Try to find the collections section using keywords - check for exact header matches first
    for (const keyword of collectionKeywords) {
      // Look for the collections header format like "10. Collections" or chapter-style headers
      const regex = new RegExp(`(\\d+\\.\\s*${keyword})|(^\\s*${keyword}\\s*$)`, 'i');
      const match = rawText.match(regex);
      
      if (match) {
        collectionsHeaderIndex = match.index || -1;
        
        if (collectionsHeaderIndex !== -1) {
          console.log(`Found collections header "${match[0]}" at position ${collectionsHeaderIndex}`);
          
          // Estimate which page this content is on based on character position
          const approximateCharsPerPage = 3500; // Adjust based on your reports
          collectionsPageNumber = Math.floor(collectionsHeaderIndex / approximateCharsPerPage) + 1;
          
          console.log(`Estimated collections page: ${collectionsPageNumber} based on header match`);
          break;
        }
      }
    }
    
    // If header format not found, try broader keyword search
    if (collectionsPageNumber === -1) {
      for (const keyword of collectionKeywords) {
        const keywordIndex = rawText.toLowerCase().indexOf(keyword.toLowerCase());
        if (keywordIndex !== -1) {
          // Estimate which page this content is on
          const textBeforeKeyword = rawText.substring(0, keywordIndex);
          const approximateLineNumber = textBeforeKeyword.split("\n").length;
          // Estimate 40 lines per page (adjust as needed)
          collectionsPageNumber = Math.floor(approximateLineNumber / 40) + 1;
          console.log(`Found collections keyword "${keyword}" around page ${collectionsPageNumber}`);
          break;
        }
      }
    }
    
    // If still not found, look for collection agency data patterns
    if (collectionsPageNumber === -1) {
      // Look for patterns like "Collection Agency:" or "Date Reported:" which are common in collection entries
      const collectionPatterns = [
        /collection agency\s*:\s*([^\n]+)/i,
        /date reported\s*:\s*([^\n]+)/i,
        /original creditor\s*:\s*([^\n]+)/i,
        /account designator code\s*:/i,
        /placed (?:with|for) collection/i,
        /debt (?:collector|collection)/i,
        /account (?:sent|placed|assigned) (?:to|with) collection/i
      ];
      
      for (const pattern of collectionPatterns) {
        const match = rawText.match(pattern);
        if (match) {
          console.log(`Found collection data pattern: ${match[0]}`);
          const textBeforeMatch = rawText.substring(0, match.index || 0);
          const approximateLineNumber = textBeforeMatch.split("\n").length;
          collectionsPageNumber = Math.floor(approximateLineNumber / 40) + 1;
          break;
        }
      }
    }
    
    // If still not found, try page estimation based on document structure or navigation indicators
    if (collectionsPageNumber === -1) {
      const totalPages = pdfData.pdfDocument.numPages;
      
      // Look for navigation indicators like "Collections" tab at bottom of pages
      const navigationMatch = rawText.match(/Summary.*Revolving.*Mortgage.*Installment.*Collections/i);
      if (navigationMatch) {
        const textBeforeNav = rawText.substring(0, navigationMatch.index || 0);
        const approximateLineNumber = textBeforeNav.split("\n").length;
        collectionsPageNumber = Math.floor(approximateLineNumber / 40) + 1;
        console.log(`Found collections via navigation tabs around page ${collectionsPageNumber}`);
      } else {
        // Collections typically appear in the latter half of credit reports
        collectionsPageNumber = Math.floor(2 * totalPages / 3);
        console.log(`No collections keyword found, trying estimated page ${collectionsPageNumber}`);
      }
    }
    
    // Ensure page number is valid
    const numPages = pdfData.pdfDocument.numPages;
    if (collectionsPageNumber < 1) collectionsPageNumber = 1;
    if (collectionsPageNumber > numPages) collectionsPageNumber = numPages;
    
    // Try the identified page and several surrounding pages
    console.log(`Attempting to extract from page ${collectionsPageNumber} and surrounding pages`);
    let imageUrl = null;
    
    // Try the primary page first
    imageUrl = await convertPDFPageToImage(pdfData.pdfDocument, collectionsPageNumber);
    
    // If we still don't have a valid image, try a few pages before and after
    if (!imageUrl) {
      const pagesToCheck = [];
      // Add 2 pages before and after the estimated page, but prioritize pages after
      for (let i = 1; i <= 2; i++) {
        if (collectionsPageNumber + i <= numPages) {
          pagesToCheck.push(collectionsPageNumber + i);
        }
        if (collectionsPageNumber - i >= 1) {
          pagesToCheck.push(collectionsPageNumber - i);
        }
      }
      
      // Try each page until we find an image
      for (const pageNum of pagesToCheck) {
        if (!imageUrl) {
          console.log(`Trying collections page ${pageNum}`);
          imageUrl = await convertPDFPageToImage(pdfData.pdfDocument, pageNum);
          if (imageUrl) {
            console.log(`Found collections image on page ${pageNum}`);
            break;
          }
        }
      }
    }
    
    // If still no image found, try scanning all pages as a last resort
    if (!imageUrl && numPages <= 20) { // Only do this for reasonable-sized documents
      console.log("No collections found on expected pages, scanning all pages");
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        // Skip pages we've already checked
        // Define pagesToTry based on the pages we've already checked
        const pagesToTry = [collectionsPageNumber];
        // Also add the pages we tried from our pagesToCheck array
        if (typeof pagesToCheck !== 'undefined') {
          pagesToTry.push(...pagesToCheck);
        }
        
        if (!pagesToTry.includes(pageNum)) {
          console.log(`Scanning page ${pageNum} for collections`);
          imageUrl = await convertPDFPageToImage(pdfData.pdfDocument, pageNum);
          if (imageUrl) {
            console.log(`Found potential collections image on page ${pageNum}`);
            break;
          }
        }
      }
    }
    
    if (imageUrl) {
      console.log("Successfully extracted collections table image");
      collectionsTableImageURL = imageUrl;
      return imageUrl;
    } else {
      console.error("Failed to extract collections page image");
      return null;
    }
  } catch (error) {
    console.error("Error extracting collections table image:", error);
    return null;
  }
};
