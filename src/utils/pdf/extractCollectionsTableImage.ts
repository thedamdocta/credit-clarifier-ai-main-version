
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
    if (!pdfData || !pdfData.pdfDoc) {
      console.error("No PDF document available for collections table extraction");
      return null;
    }
    
    // Keywords to identify collections section in the report
    const collectionKeywords = [
      "collection account",
      "collection accounts",
      "accounts in collection",
      "collection information"
    ];
    
    // Search text for collections section
    const rawText = report.rawText || "";
    let collectionsPageNumber = -1;
    
    // Try to find the collections section using keywords
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
    
    // If not found, try page estimation based on document structure
    if (collectionsPageNumber === -1) {
      const totalPages = pdfData.pdfDoc.numPages;
      // Collections typically appear in the middle of credit reports
      collectionsPageNumber = Math.floor(totalPages / 2);
      console.log(`No collections keyword found, trying estimated page ${collectionsPageNumber}`);
    }
    
    // Ensure page number is valid
    const numPages = pdfData.pdfDoc.numPages;
    if (collectionsPageNumber < 1) collectionsPageNumber = 1;
    if (collectionsPageNumber > numPages) collectionsPageNumber = numPages;
    
    // Convert the page to an image
    console.log(`Converting collections page ${collectionsPageNumber} to image`);
    const imageUrl = await convertPDFPageToImage(pdfData.pdfDoc, collectionsPageNumber);
    
    if (imageUrl) {
      console.log("Successfully extracted collections table image");
      collectionsTableImageURL = imageUrl;
      return imageUrl;
    } else {
      console.error("Failed to convert collections page to image");
      return null;
    }
  } catch (error) {
    console.error("Error extracting collections table image:", error);
    return null;
  }
};
