
// PDF text extraction functionality
import { ProgressCallbacks } from '../progressHandling';

// Extract text from PDF document
export async function extractTextInBatches(
  pdf: any, 
  updateProgress: (progress: number) => void,
  pagesToProcess: number
): Promise<string> {
  let extractedText = "";
  
  console.log(`Extracting text from ${pagesToProcess} pages...`);
  
  // Process all pages
  for (let page = 1; page <= pagesToProcess; page++) {
    // Yield to UI thread occasionally
    if (page % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    try {
      const pageObj = await pdf.getPage(page);
      const textContent = await pageObj.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      extractedText += pageText + " ";
      
      // Update progress proportionally
      const progress = Math.round((page / pagesToProcess) * 20);
      updateProgress(45 + progress);
      
      // Clean up page resources
      if (pageObj && pageObj.cleanup) {
        pageObj.cleanup();
      }
    } catch (error) {
      console.error(`Error extracting text from page ${page}:`, error);
      // Continue with next page
    }
  }
  
  console.log("Extracted text from PDF, length:", extractedText.length);
  return extractedText;
}

// Function to determine how many pages to process for a document
export function determinePageCountForProcessing(pdf: any): number {
  // Process all pages by default
  return pdf.numPages;
}
