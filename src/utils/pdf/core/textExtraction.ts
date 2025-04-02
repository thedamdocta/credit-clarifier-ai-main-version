// PDF text extraction functionality
import { ProgressCallbacks } from '../progressHandling';

// Optimized batch size for better performance while preventing UI freezing
// Adjust batch sizes based on performance testing
const MAX_PAGES_BATCH = 10; // Reduced from 20 to 10 for better UI responsiveness
const SUB_BATCH_SIZE = 3; // Reduced from 5 to 3 for more frequent yields to the UI

// Maximum pages to process for very large documents - keep at 300
const MAX_PAGES_TO_PROCESS = 300;

// Extract text from PDF document in smaller batches to prevent UI freezing
export async function extractTextInBatches(
  pdf: any, 
  updateProgress: (progress: number) => void,
  pagesToProcess: number
): Promise<string> {
  // Limit pages to process for very large documents
  const actualPagesToProcess = pdf.numPages > MAX_PAGES_TO_PROCESS 
    ? MAX_PAGES_TO_PROCESS 
    : pagesToProcess;
    
  let extractedText = "";
  
  console.log(`Extracting text from ${actualPagesToProcess} pages in batches (limiting from ${pagesToProcess})...`);
  
  // Track start time to detect long-running extractions
  const startTime = Date.now();
  const timeoutDuration = 180000; // 3 minutes timeout for extraction
  
  // Process in smaller batches with more frequent UI yields
  for (let startPage = 1; startPage <= actualPagesToProcess; startPage += MAX_PAGES_BATCH) {
    // Check if extraction is taking too long
    if (Date.now() - startTime > timeoutDuration) {
      console.log('Text extraction taking too long, continuing with partial text');
      break; // Exit the loop and return what we have so far
    }
    
    // Yield to UI between batches - CRITICAL for preventing "page unresponsive" dialogs
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const endPage = Math.min(startPage + MAX_PAGES_BATCH - 1, actualPagesToProcess);
    console.log(`Processing batch of pages ${startPage}-${endPage}...`);
    
    try {
      // Extract text with optimized memory handling
      const batchText = await extractBatchText(pdf, startPage, endPage);
      extractedText += batchText;
      
      // Explicit garbage collection hints for memory management
      if (typeof window !== 'undefined' && window.gc) {
        try {
          window.gc();
        } catch (e) {
          // Ignore if gc is not available
        }
      }
    } catch (error) {
      console.error(`Error extracting batch ${startPage}-${endPage}:`, error);
      // Continue with next batch even if this one failed
    }
    
    // Update progress proportionally based on pages processed
    const progressIncrement = 15 * ((endPage - startPage + 1) / actualPagesToProcess);
    updateProgress(45 + progressIncrement);
  }
  
  // Add a note if we limited the text extraction
  if (pagesToProcess > actualPagesToProcess) {
    extractedText += `\n\n[Note: Only processed first ${actualPagesToProcess} pages of ${pagesToProcess} total pages for performance.]`;
  }
  
  console.log("Extracted text from PDF, length:", extractedText.length);
  return extractedText;
}

// Helper function to extract text from a batch of pages with better memory management
// and more frequent yields to the UI thread
async function extractBatchText(pdf: any, startPage: number, endPage: number): Promise<string> {
  try {
    // Process pages in even smaller sub-batches to prevent memory issues
    let batchText = "";
    
    for (let i = startPage; i <= endPage; i += SUB_BATCH_SIZE) {
      const subEndPage = Math.min(i + SUB_BATCH_SIZE - 1, endPage);
      
      // Yield to UI thread before processing sub-batch
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Get pages for this sub-batch
      for (let j = i; j <= subEndPage; j++) {
        try {
          const page = await pdf.getPage(j);
          
          try {
            // Extract text, but yield to UI thread first
            await new Promise(resolve => setTimeout(resolve, 0));
            
            const textContent = await page.getTextContent({
              normalizeWhitespace: true,
              disableCombineTextItems: false
            });
            
            // Process a smaller chunk at a time
            const texts: string[] = [];
            const chunkSize = 50; // Process 50 items at a time
            
            for (let k = 0; k < textContent.items.length; k += chunkSize) {
              const chunk = textContent.items.slice(k, k + chunkSize);
              const chunkText = chunk.map((item: any) => item.str).join(" ");
              texts.push(chunkText);
              
              // Yield to UI every chunk to prevent freezing
              if (k % (chunkSize * 2) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }
            
            batchText += texts.join(" ") + " ";
            
            // Clean up page data immediately after extraction
            if (page && typeof page.cleanup === 'function') {
              page.cleanup();
            }
            
            // Clear references to help garbage collection
            textContent.items = null;
          } catch (e) {
            console.error(`Error extracting text from page ${j}:`, e);
            // Continue with other pages
          }
        } catch (e) {
          console.error(`Error getting page ${j}:`, e);
          // Continue with other pages
        }
        
        // Yield to UI every page to prevent freezing
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return batchText;
  } catch (error) {
    console.error(`Error in batch text extraction:`, error);
    return "";
  }
}

// Function to determine how many pages to process for a document
export function determinePageCountForProcessing(pdf: any, showToast: (message: string) => void): number {
  const numPages = pdf.numPages;
  
  // For extremely large documents, limit page count
  if (numPages > MAX_PAGES_TO_PROCESS) {
    console.log(`Document has ${numPages} pages, limiting processing to ${MAX_PAGES_TO_PROCESS} pages for performance`);
    showToast(`Large document detected (${numPages} pages). Processing first ${MAX_PAGES_TO_PROCESS} pages.`);
    return MAX_PAGES_TO_PROCESS;
  }
  
  // For moderately large documents, show a warning but process all pages
  if (numPages > 100) {
    console.log(`Processing all ${numPages} pages of moderately large document`);
    showToast(`Processing ${numPages} pages - this may take a while`);
  }
  
  // Process all pages for normal sized documents
  return numPages;
}
