
import { CreditReport } from "@/lib/types/creditReport";
import { getCurrentPDFData } from "./extractText";
import { convertPDFPageToImage } from "./pdfToImage";

// Store the extracted inquiries table image URL
let inquiriesTableImageURL: string | null = null;

export const resetInquiriesTableImage = () => {
  inquiriesTableImageURL = null;
};

export const extractInquiriesTableImage = async (report: CreditReport): Promise<string | null> => {
  try {
    // Return cached image if available
    if (inquiriesTableImageURL) {
      console.log("Using cached inquiries table image");
      return inquiriesTableImageURL;
    }
    
    console.log("Attempting to extract inquiries table image from PDF");
    
    // Get PDF data from current session
    const pdfData = getCurrentPDFData();
    if (!pdfData || !pdfData.pdfDocument) {
      console.error("No PDF document available for inquiries table extraction");
      return null;
    }
    
    // Keywords to identify inquiries section in the report
    const inquiriesKeywords = [
      "inquiries",
      "credit inquiries",
      "companies that requested your credit information",
      "hard inquiries",
      "soft inquiries"
    ];
    
    // Search text for inquiries section
    const rawText = report.rawText || "";
    let inquiriesPageNumber = -1;
    
    // Try to find the inquiries section using keywords
    for (const keyword of inquiriesKeywords) {
      const keywordIndex = rawText.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordIndex !== -1) {
        // Estimate which page this content is on
        const textBeforeKeyword = rawText.substring(0, keywordIndex);
        const approximateLineNumber = textBeforeKeyword.split("\n").length;
        // Estimate 40 lines per page (adjust as needed)
        inquiriesPageNumber = Math.floor(approximateLineNumber / 40) + 1;
        console.log(`Found inquiries keyword "${keyword}" around page ${inquiriesPageNumber}`);
        break;
      }
    }
    
    // If not found, try page estimation based on document structure
    if (inquiriesPageNumber === -1) {
      const totalPages = pdfData.pdfDocument.numPages;
      // Inquiries typically appear near the end of credit reports
      inquiriesPageNumber = Math.floor(2 * totalPages / 3);
      console.log(`No inquiries keyword found, trying estimated page ${inquiriesPageNumber}`);
    }
    
    // Ensure page number is valid
    const numPages = pdfData.pdfDocument.numPages;
    if (inquiriesPageNumber < 1) inquiriesPageNumber = 1;
    if (inquiriesPageNumber > numPages) inquiriesPageNumber = numPages;
    
    // Convert the page to an image
    console.log(`Converting inquiries page ${inquiriesPageNumber} to image`);
    const imageUrl = await convertPDFPageToImage(pdfData.pdfDocument, inquiriesPageNumber);
    
    if (imageUrl) {
      console.log("Successfully extracted inquiries table image");
      inquiriesTableImageURL = imageUrl;
      return imageUrl;
    } else {
      console.error("Failed to convert inquiries page to image");
      return null;
    }
  } catch (error) {
    console.error("Error extracting inquiries table image:", error);
    return null;
  }
};
