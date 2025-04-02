
// Utilities for locating and extracting tables from PDF documents
import { convertPDFPageToImage } from "../pdfToImage";
import { 
  getCurrentPDFDocument, 
  getTableImageUrl, 
  setTableImageUrl,
  addScannedPage, 
  getScannedPages 
} from "./storageManager";

/**
 * Extract the credit accounts table image from the PDF
 * This uses image-based extraction specifically for the account table
 */
export const extractCreditAccountsTableImage = async (report: any): Promise<string | null> => {
  try {
    console.log("Attempting to extract credit accounts table image");
    
    // If we already have a table image URL cached, return it
    const cachedTableImageUrl = getTableImageUrl();
    if (cachedTableImageUrl) {
      console.log("Using cached table image URL");
      return cachedTableImageUrl;
    }
    
    // If no PDF document is available, we can't extract an image
    const pdfDocument = getCurrentPDFDocument();
    if (!pdfDocument) {
      console.error("No PDF document available for image extraction");
      return null;
    }
    
    const numPages = pdfDocument.numPages;
    
    console.log(`PDF has ${numPages} pages. Scanning all pages for credit accounts table...`);
    
    // First pass: Check all pages with keywords to find potential account table pages
    const pageScores: {pageNum: number, score: number}[] = [];
    
    // Comprehensive keywords that indicate credit account tables
    const tableKeywords = [
      // Section headers
      'account summary', 'credit accounts', 'accounts summary', 'summary of your accounts',
      // Column headers
      'account type', 'account types', 'revolving', 'mortgage', 'installment', 'with balance',
      'total balance', 'available credit', 'credit limit', 'debt-to-credit', 'payment',
      // Common text in account sections
      'total accounts', 'open accounts', 'closed accounts', 'balances', 'credit utilization',
      // Account types 
      'total', 'other', 'collection'
    ];
    
    // Check all pages for keyword matches
    console.log("First pass: Scanning all pages for keywords...");
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
        
        // Calculate a score based on keyword matches
        let score = 0;
        let matchedKeywords: string[] = [];
        
        tableKeywords.forEach(keyword => {
          if (pageText.includes(keyword.toLowerCase())) {
            // Important keywords get higher scores
            if (['account summary', 'credit accounts', 'account type', 'revolving'].includes(keyword.toLowerCase())) {
              score += 2;
            } else {
              score += 1;
            }
            matchedKeywords.push(keyword);
          }
        });
        
        // Check for patterns like "X accounts with balances" which are very indicative of account tables
        if (/\d+\s+accounts\s+with\s+balances?/.test(pageText) || 
            /accounts?\s+with\s+balances?/.test(pageText)) {
          score += 3;
          matchedKeywords.push("accounts with balances pattern");
        }
        
        // Track pages we've scanned
        addScannedPage(i);
        
        console.log(`Page ${i} scored ${score} with matches: ${matchedKeywords.join(', ')}`);
        pageScores.push({pageNum: i, score});
        
      } catch (error) {
        console.error(`Error scanning page ${i}:`, error);
      }
    }
    
    // Sort pages by score descending
    pageScores.sort((a, b) => b.score - a.score);
    console.log("Pages ranked by relevance:", pageScores);
    
    // Try to extract from the highest scored pages first
    for (const {pageNum, score} of pageScores) {
      if (score >= 2) { // Only try pages with at least a decent score
        console.log(`Attempting to extract table image from high-scoring page ${pageNum} (score: ${score})`);
        const imageData = await convertPDFPageToImage(pdfDocument, pageNum);
        
        if (imageData) {
          console.log(`Successfully extracted image from page ${pageNum}`);
          setTableImageUrl(imageData);
          return imageData;
        }
      }
    }
    
    // If we couldn't find a good match with a score >= 2, try the top 3 pages
    console.log("No high-scoring pages yielded good images, trying top 3 pages...");
    const topPages = pageScores.slice(0, Math.min(3, pageScores.length));
    
    for (const {pageNum} of topPages) {
      console.log(`Fallback: extracting image from page ${pageNum}`);
      const imageData = await convertPDFPageToImage(pdfDocument, pageNum);
      
      if (imageData) {
        console.log(`Fallback succeeded: extracted image from page ${pageNum}`);
        setTableImageUrl(imageData);
        return imageData;
      }
    }
    
    // Last resort: just try the first few pages
    console.log("Last resort: trying first few pages...");
    for (let i = 1; i <= Math.min(5, numPages); i++) {
      try {
        // Skip pages we've already tried
        if (topPages.some(p => p.pageNum === i)) {
          continue;
        }
        
        console.log(`Last resort: extracting from page ${i}`);
        const imageData = await convertPDFPageToImage(pdfDocument, i);
        
        if (imageData) {
          console.log(`Last resort succeeded: extracted image from page ${i}`);
          setTableImageUrl(imageData);
          return imageData;
        }
      } catch (error) {
        console.error(`Error extracting image from page ${i}:`, error);
      }
    }
    
    console.error("Failed to extract any useful table images from PDF");
    return null;
  } catch (error) {
    console.error("Error extracting credit accounts table image:", error);
    return null;
  }
};
