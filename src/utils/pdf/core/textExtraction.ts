
// PDF text extraction functionality
import { ProgressCallbacks } from '../progressHandling';

// Optimized batch size for better performance while preventing UI freezing
const MAX_PAGES_BATCH = 15; // Increased from 10 to 15 for better throughput
const SUB_BATCH_SIZE = 3; // Keep this the same to prevent memory issues

// Maximum pages to process for very large documents - increased to 200 to handle medium-large PDFs
const MAX_PAGES_TO_PROCESS = 200;

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
  const timeoutDuration = 60000; // Increased from 30s to 60s for larger documents
  
  // Process in smaller batches
  for (let startPage = 1; startPage <= actualPagesToProcess; startPage += MAX_PAGES_BATCH) {
    // Check if extraction is taking too long
    if (Date.now() - startTime > timeoutDuration) {
      console.log('Text extraction taking too long, continuing with partial text');
      break; // Exit the loop and return what we have so far
    }
    
    // Yield to UI between batches
    await new Promise(resolve => setTimeout(resolve, 10));
    
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
async function extractBatchText(pdf: any, startPage: number, endPage: number): Promise<string> {
  try {
    // Process pages in even smaller sub-batches to prevent memory issues
    let batchText = "";
    
    for (let i = startPage; i <= endPage; i += SUB_BATCH_SIZE) {
      const subEndPage = Math.min(i + SUB_BATCH_SIZE - 1, endPage);
      
      // Get pages for this sub-batch
      for (let j = i; j <= subEndPage; j++) {
        try {
          const page = await pdf.getPage(j);
          
          try {
            // Extract and immediately process text to free memory
            const textContent = await page.getTextContent({
              normalizeWhitespace: true, // Better text formatting
              disableCombineTextItems: false // Combine text for better results
            });
            
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");
              
            batchText += pageText + " ";
            
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
        await new Promise(resolve => setTimeout(resolve, 0));
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
  
  // For extremely large documents, limit the page count but increased from 100 to 200
  if (numPages > 200) {
    console.log(`Document has ${numPages} pages, limiting processing to ${MAX_PAGES_TO_PROCESS} pages for performance`);
    showToast(`Large document detected (${numPages} pages). Processing first ${MAX_PAGES_TO_PROCESS} pages.`);
    return MAX_PAGES_TO_PROCESS;
  }
  
  // For moderately large documents, show a warning but process all pages
  if (numPages > 50) {
    console.log(`Processing all ${numPages} pages of moderately large document`);
    showToast(`Processing ${numPages} pages - this may take a while`);
  }
  
  // Process all pages for normal sized documents
  return numPages;
}
