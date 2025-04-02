
// PDF text extraction functionality
import { ProgressCallbacks } from '../progressHandling';

// Restore original batch size to prevent over-optimization
const MAX_PAGES_BATCH = 10; // Increased from 5 to 10
// Restore higher page limit to match previous behavior
const MAX_PAGES_FOR_TEXT = 100; // Increased from 50 to 100

// Extract text from PDF document in smaller batches to prevent UI freezing
export async function extractTextInBatches(
  pdf: any, 
  updateProgress: (progress: number) => void,
  pagesToProcess: number
): Promise<string> {
  let extractedText = "";
  
  console.log(`Extracting text from ${pagesToProcess} pages in batches...`);
  
  // Process in smaller batches
  for (let startPage = 1; startPage <= pagesToProcess; startPage += MAX_PAGES_BATCH) {
    // Yield to UI between batches - reduced delay to match original behavior
    await new Promise(resolve => setTimeout(resolve, 50)); // Changed from 100 to 50ms
    
    const endPage = Math.min(startPage + MAX_PAGES_BATCH - 1, pagesToProcess);
    console.log(`Processing batch of pages ${startPage}-${endPage}...`);
    
    // Extract text from current batch with longer timeout (matching original)
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
    
    // Restore original timeout for batch processing
    try {
      const batchText = await Promise.race([
        batchTextExtractionPromise(),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error(`Batch ${startPage}-${endPage} extraction timed out`)), 30000)
        ) // Increased from 15s to 30s timeout
      ]);
      
      extractedText += batchText;
    } catch (error) {
      console.error(`Skipping batch ${startPage}-${endPage} due to timeout`);
      // Continue processing other batches even if this one failed
    }
    
    // Update progress proportionally based on pages processed
    const progressIncrement = 15 * ((endPage - startPage + 1) / pagesToProcess);
    updateProgress(45 + progressIncrement);
  }
  
  console.log("Extracted text from PDF, length:", extractedText.length);
  return extractedText;
}

// Function to determine how many pages to process for a document
export function determinePageCountForProcessing(pdf: any, showToast: (message: string) => void): number {
  const numPages = pdf.numPages;
  
  // Less aggressive page limiting to match original behavior
  let pagesToProcess = numPages;
  
  if (numPages > MAX_PAGES_FOR_TEXT) {
    pagesToProcess = MAX_PAGES_FOR_TEXT;
    showToast(`Processing first ${MAX_PAGES_FOR_TEXT} pages of ${numPages} to improve performance`);
  } else if (numPages > 50) {
    // For larger documents, use a more generous page limit
    pagesToProcess = Math.min(50, numPages);
    showToast(`Processing first ${pagesToProcess} pages for better performance`);
  }
  
  return pagesToProcess;
}

