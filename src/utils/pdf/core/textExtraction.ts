
// PDF text extraction functionality
import { ProgressCallbacks } from '../progressHandling';

// Increased batch size for better performance while preventing UI freezing
const MAX_PAGES_BATCH = 25; // Increased from 20 to 25 for better throughput

// Extract text from PDF document in smaller batches to prevent UI freezing
export async function extractTextInBatches(
  pdf: any, 
  updateProgress: (progress: number) => void,
  pagesToProcess: number
): Promise<string> {
  let extractedText = "";
  
  console.log(`Extracting text from ${pagesToProcess} pages in batches...`);
  
  // Track start time to detect long-running extractions
  const startTime = Date.now();
  
  // Process in smaller batches
  for (let startPage = 1; startPage <= pagesToProcess; startPage += MAX_PAGES_BATCH) {
    // Check if extraction is taking too long
    if (Date.now() - startTime > 45000) { // 45 seconds timeout
      console.log('Image extraction taking too long, continuing process');
      break; // Exit the loop and return what we have so far
    }
    
    // Yield to UI between batches - shorter delay for responsiveness
    await new Promise(resolve => setTimeout(resolve, 30)); // Reduced from 50ms to 30ms
    
    const endPage = Math.min(startPage + MAX_PAGES_BATCH - 1, pagesToProcess);
    console.log(`Processing batch of pages ${startPage}-${endPage}...`);
    
    try {
      // Extract text with optimized memory handling
      const batchText = await extractBatchText(pdf, startPage, endPage);
      extractedText += batchText;
    } catch (error) {
      console.error(`Error extracting batch ${startPage}-${endPage}:`, error);
      // Continue with next batch even if this one failed
    }
    
    // Update progress proportionally based on pages processed
    const progressIncrement = 15 * ((endPage - startPage + 1) / pagesToProcess);
    updateProgress(45 + progressIncrement);
  }
  
  console.log("Extracted text from PDF, length:", extractedText.length);
  return extractedText;
}

// Helper function to extract text from a batch of pages with better memory management
async function extractBatchText(pdf: any, startPage: number, endPage: number): Promise<string> {
  try {
    // Process pages in even smaller sub-batches to prevent memory issues
    let batchText = "";
    const SUB_BATCH_SIZE = 5;
    
    for (let i = startPage; i <= endPage; i += SUB_BATCH_SIZE) {
      const subEndPage = Math.min(i + SUB_BATCH_SIZE - 1, endPage);
      
      // Get pages for this sub-batch
      const pages = [];
      for (let j = i; j <= subEndPage; j++) {
        try {
          const page = await pdf.getPage(j);
          pages.push(page);
        } catch (e) {
          console.error(`Error getting page ${j}:`, e);
          // Continue with other pages
        }
      }
      
      // Process text from each page
      for (let page of pages) {
        try {
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          batchText += pageText + " ";
          
          // Clean up page data immediately after extraction to free memory
          if (page && page.cleanup) {
            page.cleanup();
          }
        } catch (e) {
          console.error(`Error extracting text from page:`, e);
          // Continue with other pages
        }
      }
      
      // Yield to UI after each sub-batch
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return batchText;
  } catch (error) {
    console.error(`Error in batch text extraction:`, error);
    return "";
  }
}

// Function to determine how many pages to process for a document
export function determinePageCountForProcessing(pdf: any, showToast: (message: string) => void): number {
  // Process all pages - no page limit
  return pdf.numPages;
}
