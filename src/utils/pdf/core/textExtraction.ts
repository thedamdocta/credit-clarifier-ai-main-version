
// PDF text extraction functionality
import { ProgressCallbacks } from '../progressHandling';

// Maximum number of pages to process at once to prevent UI blocking
const MAX_PAGES_BATCH = 20;
// Maximum pages for initial text extraction (prevents hanging on huge files)
const MAX_PAGES_FOR_TEXT = 100;

// Extract text from PDF document in batches to prevent UI freezing
export async function extractTextInBatches(
  pdf: any, 
  updateProgress: (progress: number) => void,
  pagesToProcess: number
): Promise<string> {
  let extractedText = "";
  
  console.log(`Extracting text from ${pagesToProcess} pages in batches...`);
  
  // Process in small batches
  for (let startPage = 1; startPage <= pagesToProcess; startPage += MAX_PAGES_BATCH) {
    await new Promise(resolve => setTimeout(resolve, 50)); // Yield to UI between batches
    
    const endPage = Math.min(startPage + MAX_PAGES_BATCH - 1, pagesToProcess);
    console.log(`Processing batch of pages ${startPage}-${endPage}...`);
    
    // Extract text from current batch with timeout
    const batchTextExtractionPromise = async () => {
      try {
        const batchPages = [];
        // Get pages for this batch
        for (let i = startPage; i <= endPage; i++) {
          const page = await pdf.getPage(i);
          batchPages.push(page);
        }
        
        // Process text from each page
        let batchText = "";
        for (let page of batchPages) {
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          batchText += pageText + " ";
          
          // Clean up page data after extraction to free memory
          if (page && page.cleanup) {
            page.cleanup();
          }
        }
        
        return batchText;
      } catch (error) {
        console.error(`Error extracting batch ${startPage}-${endPage}:`, error);
        return "";
      }
    };
    
    // Add batch text with timeout protection
    const batchText = await Promise.race([
      batchTextExtractionPromise(),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error(`Batch ${startPage}-${endPage} extraction timed out`)), 30000)
      )
    ]);
    
    extractedText += batchText;
    
    // Update progress proportionally based on pages processed
    const progressIncrement = 15 * ((endPage - startPage + 1) / pagesToProcess);
    updateProgress(45 + progressIncrement);
  }
  
  console.log("Successfully extracted text from PDF, length:", extractedText.length);
  return extractedText;
}

// Function to determine how many pages to process for a document
export function determinePageCountForProcessing(pdf: any, showToast: (message: string) => void): number {
  const numPages = pdf.numPages;
  
  // For very large PDFs, limit initial extraction to prevent freezing
  const pagesToProcess = Math.min(numPages, MAX_PAGES_FOR_TEXT);
  
  if (numPages > MAX_PAGES_FOR_TEXT) {
    showToast(`Processing first ${MAX_PAGES_FOR_TEXT} pages of ${numPages} to prevent freezing`);
  }
  
  return pagesToProcess;
}
