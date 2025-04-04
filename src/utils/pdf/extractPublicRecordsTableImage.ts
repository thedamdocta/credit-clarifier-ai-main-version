
import { CreditReport } from "@/lib/types/creditReport";
import { getCurrentPDFData } from "./extractText";
import { convertPDFPageToImage } from "./pdfToImage";

// Store the extracted public records table image URL
let publicRecordsTableImageURL: string | null = null;

export const resetPublicRecordsTableImage = () => {
  publicRecordsTableImageURL = null;
};

export const extractPublicRecordsTableImage = async (report: CreditReport): Promise<string | null> => {
  try {
    // Return cached image if available
    if (publicRecordsTableImageURL) {
      console.log("Using cached public records table image");
      return publicRecordsTableImageURL;
    }
    
    console.log("Attempting to extract public records table image from PDF");
    
    // Get PDF data from current session
    const pdfData = getCurrentPDFData();
    if (!pdfData || !pdfData.pdfDocument) {
      console.error("No PDF document available for public records table extraction");
      return null;
    }
    
    // Keywords to identify public records section in the report
    const publicRecordKeywords = [
      "public records",
      "bankruptcies",
      "judgments",
      "liens",
      "legal items"
    ];
    
    // Search text for public records section
    const rawText = report.rawText || "";
    let publicRecordsPageNumber = -1;
    
    // Try to find the public records section using keywords
    for (const keyword of publicRecordKeywords) {
      const keywordIndex = rawText.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordIndex !== -1) {
        // Estimate which page this content is on
        const textBeforeKeyword = rawText.substring(0, keywordIndex);
        const approximateLineNumber = textBeforeKeyword.split("\n").length;
        // Estimate 40 lines per page (adjust as needed)
        publicRecordsPageNumber = Math.floor(approximateLineNumber / 40) + 1;
        console.log(`Found public records keyword "${keyword}" around page ${publicRecordsPageNumber}`);
        break;
      }
    }
    
    // If not found, try page estimation based on document structure
    if (publicRecordsPageNumber === -1) {
      const totalPages = pdfData.pdfDocument.numPages;
      // Public records typically appear in the first third of credit reports
      publicRecordsPageNumber = Math.floor(totalPages / 3);
      console.log(`No public records keyword found, trying estimated page ${publicRecordsPageNumber}`);
    }
    
    // Ensure page number is valid
    const numPages = pdfData.pdfDocument.numPages;
    if (publicRecordsPageNumber < 1) publicRecordsPageNumber = 1;
    if (publicRecordsPageNumber > numPages) publicRecordsPageNumber = numPages;
    
    // Convert the page to an image
    console.log(`Converting public records page ${publicRecordsPageNumber} to image`);
    const imageUrl = await convertPDFPageToImage(pdfData.pdfDocument, publicRecordsPageNumber);
    
    if (imageUrl) {
      console.log("Successfully extracted public records table image");
      publicRecordsTableImageURL = imageUrl;
      return imageUrl;
    } else {
      console.error("Failed to convert public records page to image");
      return null;
    }
  } catch (error) {
    console.error("Error extracting public records table image:", error);
    return null;
  }
};
