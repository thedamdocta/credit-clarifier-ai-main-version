
import { extractTextFromImageWithOCR, processImageWithEnhancedOCR, extractTextFromImageRegion, validateImageUrl } from './ocrExtraction';
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
const storePageImage = async (image: string, pageNum: number) => {
  try {
    if (!image) {
      addLog(`Error: Attempted to store empty image for page ${pageNum}`);
      return;
    }
    
    // Validate image before storing
    const isValid = await validateImageUrl(image);
    
    if (isValid) {
      addLog(`Successfully stored debug image for page ${pageNum}`);
      extractedTableImages.push(image);
    } else {
      addLog(`Failed validation for image from page ${pageNum}`);
    }
  } catch (error) {
    addLog(`Error storing image for page ${pageNum}: ${(error as Error).message}`);
  }
};

// Main extraction function
export const extractContactInfoTables = async (pdfDocument: any): Promise<ContactInfoExtractionResult> => {
  resetExtractionData();
  addLog("Starting contact information extraction");
  
  const addresses: AddressInfo[] = [];
  const employments: EmploymentInfo[] = [];
  const relevantPageNumbers: number[] = [];
  
  try {
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
    
    if (sortedPages.length > 0) {
      // Analyze top pages in detail
      for (const pageNum of sortedPages) {
        addLog(`Analyzing page ${pageNum} in detail`);
        relevantPageNumbers.push(pageNum);
        
        // Convert the page to an image for visualization
        const pageImage = await convertPDFPageToImage(pdfDocument, pageNum);
        if (pageImage) {
          await storePageImage(pageImage, pageNum);
          addLog(`Page ${pageNum} image data length: ${pageImage.length} chars`);
        } else {
          addLog(`Failed to create image for page ${pageNum}`);
        }
        
        // Extract addresses from this page
        const pageAddresses = await extractAddressesFromPage(pdfDocument, pageNum);
        if (pageAddresses && pageAddresses.length > 0) {
          addLog(`Found ${pageAddresses.length} addresses on page ${pageNum}`);
          addresses.push(...pageAddresses);
        }
        
        // Extract employments from this page
        const pageEmployments = await extractEmploymentsFromPage(pdfDocument, pageNum);
        if (pageEmployments && pageEmployments.length > 0) {
          addLog(`Found ${pageEmployments.length} employment entries on page ${pageNum}`);
          employments.push(...pageEmployments);
        }
      }
    } else {
      // Fallback to text extraction from all pages
      addLog("No high-scoring pages found, trying text extraction from all pages");
      const { extractedAddresses, extractedEmployments, pagesWithInfo } = 
        await extractFromAllPages(pdfDocument, numPages);
        
      addresses.push(...extractedAddresses);
      employments.push(...extractedEmployments);
      relevantPageNumbers.push(...pagesWithInfo);
    }
    
    // Log the final results
    addLog(`Extraction complete. Found ${addresses.length} addresses and ${employments.length} employment records`);
    addLog(`Stored ${extractedTableImages.length} page images for debugging`);
    
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
  
  for (let i = 1; i <= numPages; i++) {
    try {
      addLog(`Quick scanning page ${i}/${numPages}`);
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      
      // Calculate a score based on keywords related to contact info
      let score = 0;
      
      // Address-related keywords
      const addressKeywords = ['address', 'street', 'avenue', 'blvd', 'lane', 'road', 'apt', 'suite', 'current', 'former', 'previous', 'residence'];
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

// Extract contact info from all pages as a fallback
const extractFromAllPages = async (pdfDocument: any, numPages: number): Promise<{
  extractedAddresses: AddressInfo[];
  extractedEmployments: EmploymentInfo[];
  pagesWithInfo: number[];
}> => {
  const extractedAddresses: AddressInfo[] = [];
  const extractedEmployments: EmploymentInfo[] = [];
  const pagesWithInfo: number[] = [];
  
  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      
      // Look for addresses
      const addresses = extractAddressesFromText(pageText);
      if (addresses.length > 0) {
        extractedAddresses.push(...addresses);
        
        if (!pagesWithInfo.includes(i)) {
          pagesWithInfo.push(i);
          
          // Generate debug image for this page
          try {
            const pageImage = await convertPDFPageToImage(pdfDocument, i);
            if (pageImage) {
              storePageImage(pageImage, i);
              addLog(`Generated debug image for page ${i} with addresses`);
            }
          } catch (error) {
            addLog(`Failed to generate image for page ${i}: ${(error as Error).message}`);
          }
        }
      }
      
      // Look for employment
      const employments = extractEmploymentsFromText(pageText);
      if (employments.length > 0) {
        extractedEmployments.push(...employments);
        
        if (!pagesWithInfo.includes(i)) {
          pagesWithInfo.push(i);
          
          // Generate debug image for this page
          try {
            const pageImage = await convertPDFPageToImage(pdfDocument, i);
            if (pageImage) {
              storePageImage(pageImage, i);
              addLog(`Generated debug image for page ${i} with employment info`);
            }
          } catch (error) {
            addLog(`Failed to generate image for page ${i}: ${(error as Error).message}`);
          }
        }
      }
    } catch (error) {
      addLog(`Error processing page ${i}: ${(error as Error).message}`);
    }
  }
  
  return { extractedAddresses, extractedEmployments, pagesWithInfo };
};

// Extract address information from a single page
const extractAddressesFromPage = async (pdfDocument: any, pageNum: number): Promise<AddressInfo[]> => {
  try {
    // Get text from the page
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    
    // First try extracting from text
    const textExtractedAddresses = extractAddressesFromText(pageText);
    if (textExtractedAddresses.length > 0) {
      addLog(`Extracted ${textExtractedAddresses.length} addresses from page ${pageNum} text`);
      return textExtractedAddresses;
    }
    
    // If that fails, try using image-based extraction
    addLog(`Attempting image-based address extraction for page ${pageNum}`);
    const pageImage = await convertPDFPageToImage(pdfDocument, pageNum);
    if (pageImage) {
      // Use extractTextFromImageWithOCR instead of extractTextFromImage
      const imageText = await extractTextFromImageWithOCR(pageImage);
      if (imageText) {
        const imageExtractedAddresses = extractAddressesFromText(imageText);
        if (imageExtractedAddresses.length > 0) {
          addLog(`Extracted ${imageExtractedAddresses.length} addresses from page ${pageNum} image`);
          return imageExtractedAddresses;
        }
      }
    }
    
    return [];
  } catch (error) {
    addLog(`Error extracting addresses from page ${pageNum}: ${(error as Error).message}`);
    return [];
  }
};

// Extract employment information from a single page
const extractEmploymentsFromPage = async (pdfDocument: any, pageNum: number): Promise<EmploymentInfo[]> => {
  try {
    // Get text from the page
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    
    // First try extracting from text
    const textExtractedEmployments = extractEmploymentsFromText(pageText);
    if (textExtractedEmployments.length > 0) {
      addLog(`Extracted ${textExtractedEmployments.length} employment records from page ${pageNum} text`);
      return textExtractedEmployments;
    }
    
    // If that fails, try using image-based extraction
    addLog(`Attempting image-based employment extraction for page ${pageNum}`);
    const pageImage = await convertPDFPageToImage(pdfDocument, pageNum);
    if (pageImage) {
      // Use extractTextFromImageWithOCR instead of extractTextFromImage
      const imageText = await extractTextFromImageWithOCR(pageImage);
      if (imageText) {
        const imageExtractedEmployments = extractEmploymentsFromText(imageText);
        if (imageExtractedEmployments.length > 0) {
          addLog(`Extracted ${imageExtractedEmployments.length} employment records from page ${pageNum} image`);
          return imageExtractedEmployments;
        }
      }
    }
    
    return [];
  } catch (error) {
    addLog(`Error extracting employments from page ${pageNum}: ${(error as Error).message}`);
    return [];
  }
};

// Extract address information from text
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
          // Determine if it's current or former based on position in the text
          // Usually the first address is current, others are former
          const status = addresses.length === 0 ? "Current" : "Former";
          
          addresses.push({
            address: address,
            status: status,
            dateReported: ""
          });
        }
      }
    }
    
    // Basic address patterns without extra context
    const basicAddressPattern = /(\d+\s+[A-Za-z\s\.]+(?:,\s*[A-Za-z\s]+){1,2},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/gi;
    while ((match = basicAddressPattern.exec(text)) !== null) {
      const address = match[1].trim();
      
      if (address && address.length > 10 && !addresses.some(a => a.address === address)) {
        const status = addresses.length === 0 ? "Current" : "Former";
        
        addresses.push({
          address: address,
          status: status,
          dateReported: ""
        });
      }
    }
  } catch (error) {
    addLog(`Error in address text extraction: ${(error as Error).message}`);
  }
  
  return addresses;
};

// Extract employment information from text
export const extractEmploymentsFromText = (text: string): EmploymentInfo[] => {
  const employments: EmploymentInfo[] = [];
  
  try {
    // Pattern for "Employer: Company Name, Title: Job Title"
    const employerTitlePattern = /employer:?\s*([^,]+)(?:,\s*title:?\s*([^,\n]+))?/i;
    const match = text.match(employerTitlePattern);
    
    if (match) {
      const company = match[1].trim();
      const occupation = match[2] ? match[2].trim() : "";
      
      if (company && company.length > 2 && !employments.some(e => e.company === company)) {
        employments.push({
          company,
          occupation
        });
      }
    }
    
    // Pattern for "Employment: Company Name"
    const employmentPattern = /employment:?\s*([^\.]+)/i;
    const empMatch = text.match(employmentPattern);
    
    if (empMatch) {
      const company = empMatch[1].trim();
      
      if (company && company.length > 2 && !employments.some(e => e.company === company)) {
        // Check if this is just a header and not actual employment data
        if (!company.toLowerCase().includes("history is") && !company.toLowerCase().includes("section contains")) {
          employments.push({
            company,
            occupation: ""
          });
        }
      }
    }
    
    // For reports that list "Company: ABC Corp, Occupation: Manager" format
    const companyOccupationPattern = /company:?\s*([^,]+)(?:,\s*occupation:?\s*([^,\n]+))?/i;
    const compMatch = text.match(companyOccupationPattern);
    
    if (compMatch) {
      const company = compMatch[1].trim();
      const occupation = compMatch[2] ? compMatch[2].trim() : "";
      
      if (company && company.length > 2 && !employments.some(e => e.company === company)) {
        employments.push({
          company,
          occupation
        });
      }
    }
    
    // Last resort: Look for standalone employment-related keywords and extract surrounding text
    if (employments.length === 0) {
      const employmentKeywords = ['employed at', 'works at', 'working at', 'employed by', 'works for'];
      
      for (const keyword of employmentKeywords) {
        const keywordRegex = new RegExp(`${keyword}\\s+([^\\.,;]+)`, 'i');
        const kwMatch = text.match(keywordRegex);
        
        if (kwMatch && kwMatch[1]) {
          const company = kwMatch[1].trim();
          
          if (company && company.length > 2 && !company.toLowerCase().includes("history") && 
              !employments.some(e => e.company === company)) {
            employments.push({
              company,
              occupation: ""
            });
          }
        }
      }
    }
  } catch (error) {
    addLog(`Error in employment text extraction: ${(error as Error).message}`);
  }
  
  return employments;
};
