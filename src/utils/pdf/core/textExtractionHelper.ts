
// Utilities for extracting text from PDF documents
import { setPDFDocument, setExtractedText } from "./storageManager";

/**
 * Extract text from the PDF document
 * @param pdfDocument The PDF document to extract text from
 * @returns A promise resolving to the extracted text
 */
export const extractTextFromPDF = async (pdfDocument: any): Promise<string> => {
  try {
    // Store reference to the PDF document for use in other functions
    setPDFDocument(pdfDocument);
    
    const numPages = pdfDocument.numPages;
    let fullText = "";
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + " ";
    }
    
    // Store the extracted text for later use
    setExtractedText(fullText);
    
    // Return the full text
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    return "";
  }
};
