
import { extractTextFromImageWithOCR, processImageWithEnhancedOCR, extractTextFromImageRegion } from './ocrExtraction';
import { convertPDFPageToImage } from '@/utils/pdf/pdfToImage';

export interface AddressInfo {
  address: string;
  status: string;
  dateReported: string;
}

export interface EmploymentInfo {
  company: string;
  occupation: string;
}

export interface ContactInfoExtractionResult {
  addresses: AddressInfo[];
  employments: EmploymentInfo[];
  pageNumbers: number[];
}

// Store extracted images for debugging
let extractedTableImages: string[] = [];
let extractionLogs: string[] = [];

// Clear logs before each extraction
export const resetExtractionData = () => {
  extractedTableImages = [];
  extractionLogs = [];
};

// Get the extracted table images
export const getContactTableImages = (): string[] => {
  return extractedTableImages;
};

// Get the extraction logs
export const getContactExtractionLogs = (): string[] => {
  return extractionLogs;
};

// Add a log entry
const addLog = (message: string) => {
  extractionLogs.push(`[${new Date().toISOString().substring(11, 19)}] ${message}`);
  console.log(`ContactInfo: ${message}`);
};

// Store a page image for debugging
const storePageImage = (image: string, pageNum: number) => {
  addLog(`Storing debug image for page ${pageNum}`);
  extractedTableImages.push(image);
  
  // Verify image is valid by creating an Image instance
  const img = new Image();
  img.onload = () => {
    addLog(`Page ${pageNum} image verified: ${img.width}x${img.height}`);
  };
  img.onerror = () => {
    addLog(`WARNING: Page ${pageNum} image verification failed - invalid image data`);
  };
  img.src = image;
};

// Main extraction function
export const extractContactInfoTables = async (pdfDocument: any): Promise<ContactInfoExtractionResult> => {
  resetExtractionData();
  addLog("Starting contact information extraction");
  
  const addresses: AddressInfo[] = [];
  const employments: EmploymentInfo[] = [];
  const relevantPageNumbers: number[] = [];
  
  try {
    if (!pdfDocument || !pdfDocument.numPages) {
      addLog("Invalid PDF document provided");
      throw new Error("Invalid PDF document provided for extraction");
    }
    
    const numPages = pdfDocument.numPages;
    addLog(`PDF has ${numPages} pages, starting analysis`);
    
    // First pass: scan all pages to find the most likely pages with contact info
    const pageScores = await scanPagesForContactInfo(pdfDocument, numPages);
    
    // Sort pages by score and get top candidates
    const sortedPages = Object.entries(pageScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => parseInt(entry[0]));
      
    addLog(`Top candidate pages for contact info: ${sortedPages.join(', ')}`);
    
    // Always attempt to convert all top pages to images
    for (const pageNum of sortedPages) {
      try {
        addLog(`Converting page ${pageNum} to image for visualization`);
        const pageImage = await convertPDFPageToImage(pdfDocument, pageNum);
        
        if (pageImage) {
          addLog(`Successfully created image for page ${pageNum}, size: ${Math.round(pageImage.length / 1024)}KB`);
          storePageImage(pageImage, pageNum);
          
          if (!relevantPageNumbers.includes(pageNum)) {
            relevantPageNumbers.push(pageNum);
          }
        } else {
          addLog(`Failed to create image for page ${pageNum} - null result`);
        }
      } catch (imgError) {
        addLog(`Error generating image for page ${pageNum}: ${(imgError as Error).message}`);
      }
    }
    
    // If no pages have high scores or we still don't have images, try the first few pages
    if (sortedPages.length === 0 || extractedTableImages.length === 0) {
      addLog("No high-scoring pages found or no images extracted, trying first few pages");
      const fallbackPages = [1, 2, 3, 4, 5].filter(p => p <= numPages && !relevantPageNumbers.includes(p));
      
      for (const pageNum of fallbackPages) {
        try {
          addLog(`Trying fallback image extraction for page ${pageNum}`);
          const pageImage = await convertPDFPageToImage(pdfDocument, pageNum);
          
          if (pageImage) {
            storePageImage(pageImage, pageNum);
            if (!relevantPageNumbers.includes(pageNum)) {
              relevantPageNumbers.push(pageNum);
            }
          }
        } catch (fallbackError) {
          addLog(`Fallback image generation failed for page ${pageNum}: ${(fallbackError as Error).message}`);
        }
      }
    }
    
    // Log the final results
    addLog(`Extraction complete. Generated ${extractedTableImages.length} page images for debugging`);
    
    return {
      addresses,
      employments,
      pageNumbers: relevantPageNumbers
    };
  } catch (error) {
    addLog(`Error extracting contact info: ${(error as Error).message}`);
    console.error("Error extracting contact info:", error);
    return {
      addresses: [],
      employments: [],
      pageNumbers: []
    };
  }
};

// Scan all pages to find those most likely to contain contact info
const scanPagesForContactInfo = async (pdfDocument: any, numPages: number): Promise<Record<number, number>> => {
  const pageScores: Record<number, number> = {};
  
  for (let i = 1; i <= Math.min(numPages, 10); i++) {
    try {
      addLog(`Quick scanning page ${i}/${numPages}`);
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      
      // Calculate a score based on keywords related to contact info
      let score = 0;
      
      // Address-related keywords
      const addressKeywords = ['address', 'street', 'avenue', 'blvd', 'lane', 'road', 'apt', 'suite', 
                              'current', 'former', 'previous', 'residence'];
      addressKeywords.forEach(keyword => {
        const matches = pageText.match(new RegExp(keyword, 'gi'));
        if (matches) score += matches.length * 2;
      });
      
      // Look for address patterns (street numbers, zip codes)
      if (/\d{3,5}\s+[A-Za-z\s]+(?:street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|circle|cir|court|ct|way)/i.test(pageText)) {
        score += 10;
        addLog(`Found address pattern on page ${i}, +10 points`);
      }
      
      // Look for zip code patterns
      if (/[A-Za-z]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/i.test(pageText)) {
        score += 8;
        addLog(`Found zip code pattern on page ${i}, +8 points`);
      }
      
      // Employment-related keywords
      const employmentKeywords = ['employer', 'employment', 'occupation', 'job', 'position', 'company', 'work', 'history'];
      employmentKeywords.forEach(keyword => {
        const matches = pageText.match(new RegExp(keyword, 'gi'));
        if (matches) score += matches.length * 2;
      });
      
      // Sections that often contain contact info
      if (/personal\s+information/i.test(pageText)) {
        score += 15;
        addLog(`Found "personal information" section on page ${i}, +15 points`);
      }
      
      if (/contact\s+information/i.test(pageText)) {
        score += 15;
        addLog(`Found "contact information" section on page ${i}, +15 points`);
      }
      
      // Store the score for this page
      pageScores[i] = score;
      
      if (score > 20) {
        addLog(`Page ${i} has high score: ${score}`);
      }
    } catch (error) {
      addLog(`Error scanning page ${i}: ${(error as Error).message}`);
    }
  }
  
  return pageScores;
};

// Extract address information from text - used for supplementing image extraction
export const extractAddressesFromText = (text: string): AddressInfo[] => {
  const addresses: AddressInfo[] = [];
  
  try {
    // Look for address blocks with status indicators
    const statusAddressRegex = /(current|former)\s+(?:address|residence)?:?\s*([^,]*,\s*[^,]*(?:,\s*[^,]*)?)/gi;
    let match;
    
    while ((match = statusAddressRegex.exec(text)) !== null) {
      const status = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const address = match[2].trim();
      
      if (address && address.length > 5 && !addresses.some(a => a.address === address)) {
        addresses.push({
          address: address,
          status: status,
          dateReported: ""
        });
      }
    }
    
    // Look for addresses with street patterns
    const streetPatterns = [
      /(\d+\s+[A-Za-z]+\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|cir|circle|way|pl|place)\s*[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/gi,
      /(\d+\s+[A-Za-z]+\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|cir|circle|way|pl|place)[^,]*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/gi,
      /(\d+\s+[A-Za-z\s]+(?:suite|apt|apartment|unit|#)\s*[A-Za-z0-9]+[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/gi
    ];
    
    for (const pattern of streetPatterns) {
      while ((match = pattern.exec(text)) !== null) {
        const address = match[1].trim();
        
        if (address && address.length > 10 && !addresses.some(a => a.address === address)) {
          addresses.push({
            address: address,
            status: "Unknown",
            dateReported: ""
          });
        }
      }
    }
    
    return addresses;
  } catch (error) {
    console.error("Error extracting addresses from text:", error);
    return [];
  }
};

// Extract employment information from text - used for supplementing image extraction
export const extractEmploymentsFromText = (text: string): EmploymentInfo[] => {
  const employments: EmploymentInfo[] = [];
  
  try {
    // Look for employment sections
    const employmentSectionMatch = text.match(/employment\s+history([\s\S]*?)(?:contact|personal|credit|address|public)/i);
    if (employmentSectionMatch && employmentSectionMatch[1]) {
      const employmentSection = employmentSectionMatch[1].trim();
      
      // Look for company name followed by occupation
      const companyLines = employmentSection.split('\n');
      for (let i = 0; i < companyLines.length; i++) {
        const line = companyLines[i].trim();
        if (line && line.length > 3 && !/^(company|occupation|employer):/i.test(line)) {
          employments.push({
            company: line,
            occupation: (i + 1 < companyLines.length) ? companyLines[i + 1].trim() : ""
          });
          break; // Just get the first one for now
        }
      }
    }
    
    // If no employment found in a dedicated section, look for employment keywords
    if (employments.length === 0) {
      const employerMatch = text.match(/(?:employer|employment):\s*([^\.]+)/i);
      if (employerMatch && employerMatch[1]) {
        employments.push({
          company: employerMatch[1].trim(),
          occupation: ""
        });
      }
    }
    
    return employments;
  } catch (error) {
    console.error("Error extracting employments from text:", error);
    return [];
  }
};
