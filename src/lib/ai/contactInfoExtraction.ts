
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
        
        // Explicitly generate and store page images for visualization
        try {
          addLog(`Converting page ${pageNum} to image for visualization`);
          const pageImage = await convertPDFPageToImage(pdfDocument, pageNum);
          
          if (pageImage) {
            addLog(`Successfully created image for page ${pageNum}, size: ${Math.round(pageImage.length / 1024)}KB`);
            storePageImage(pageImage, pageNum);
          } else {
            addLog(`Failed to create image for page ${pageNum} - null result`);
          }
        } catch (imgError) {
          addLog(`Error generating image for page ${pageNum}: ${(imgError as Error).message}`);
        }
        
        // Extract addresses from this page
        const pageAddresses = await extractAddressesFromPage(pdfDocument, pageNum);
        if (pageAddresses && pageAddresses.length > 0) {
          addLog(`Found ${pageAddresses.length} addresses on page ${pageNum}`);
          addresses.push(...pageAddresses);
        } else {
          addLog(`No addresses found on page ${pageNum}`);
        }
        
        // Extract employments from this page
        const pageEmployments = await extractEmploymentsFromPage(pdfDocument, pageNum);
        if (pageEmployments && pageEmployments.length > 0) {
          addLog(`Found ${pageEmployments.length} employment entries on page ${pageNum}`);
          employments.push(...pageEmployments);
        } else {
          addLog(`No employment entries found on page ${pageNum}`);
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
    
    // If we still have no images, try to generate at least one from the first page
    if (extractedTableImages.length === 0 && numPages > 0) {
      addLog("No debug images were generated, adding fallback from page 1");
      try {
        const firstPageImage = await convertPDFPageToImage(pdfDocument, 1);
        if (firstPageImage) {
          storePageImage(firstPageImage, 1);
          if (!relevantPageNumbers.includes(1)) {
            relevantPageNumbers.push(1);
          }
        }
      } catch (fallbackError) {
        addLog(`Fallback image generation failed: ${(fallbackError as Error).message}`);
      }
    }
    
    // Log the final results
    addLog(`Extraction complete. Found ${addresses.length} addresses and ${employments.length} employment records`);
    addLog(`Generated ${extractedTableImages.length} page images for debugging`);
    
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
      
      // Look for key section headers - give these high scores
      if (/personal\s+information/i.test(pageText)) {
        score += 25;
        addLog(`Found "personal information" section on page ${i}, +25 points`);
      }
      
      if (/contact\s+information/i.test(pageText)) {
        score += 25;
        addLog(`Found "contact information" section on page ${i}, +25 points`);
      }
      
      if (/identification/i.test(pageText)) {
        score += 15;
        addLog(`Found "identification" section on page ${i}, +15 points`);
      }
      
      if (/employment\s+history/i.test(pageText)) {
        score += 20;
        addLog(`Found "employment history" section on page ${i}, +20 points`);
      }
      
      // Address-related keywords
      const addressKeywords = ['address', 'street', 'avenue', 'blvd', 'lane', 'road', 'apt', 'suite', 'current', 'former', 'previous', 'residence'];
      addressKeywords.forEach(keyword => {
        const matches = pageText.match(new RegExp(keyword, 'gi'));
        if (matches) score += matches.length * 2;
      });
      
      // Look for address patterns that match the examples (street numbers, zip codes)
      if (/\d{3,5}\s+[A-Za-z\s]+(?:street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|circle|cir|court|ct|way)/i.test(pageText)) {
        score += 15;
        addLog(`Found address pattern on page ${i}, +15 points`);
      }
      
      // Check for state abbreviations followed by zip codes - common in addresses
      if (/[A-Z]{2}\s+\d{5}(?:-\d{4})?/i.test(pageText)) {
        score += 15;
        addLog(`Found state/zip pattern on page ${i}, +15 points`);
      }
      
      // Look for table patterns with Address, Status, Date Reported headers (like in example)
      if (/Address.*Status.*Date\s+Reported/i.test(pageText)) {
        score += 35;
        addLog(`Found address table pattern "Address Status Date Reported" on page ${i}, +35 points`);
      }
      
      // Look for table patterns with Company, Occupation headers (like in example)
      if (/Company.*Occupation/i.test(pageText)) {
        score += 25;
        addLog(`Found employment table pattern "Company Occupation" on page ${i}, +25 points`);
      }
      
      // Employment-related keywords
      const employmentKeywords = ['employer', 'employment', 'occupation', 'job', 'position', 'company', 'work', 'history'];
      employmentKeywords.forEach(keyword => {
        const matches = pageText.match(new RegExp(keyword, 'gi'));
        if (matches) score += matches.length * 2;
      });
      
      // Store the score for this page
      pageScores[i] = score;
      
      if (score > 40) {
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
      addLog(`Generated image for page ${pageNum} OCR processing, size: ${Math.round(pageImage.length / 1024)}KB`);
      // Use extractTextFromImageWithOCR instead of extractTextFromImage
      const imageText = await extractTextFromImageWithOCR(pageImage);
      if (imageText) {
        addLog(`OCR text extracted from page ${pageNum} image: ${imageText.length} characters`);
        const imageExtractedAddresses = extractAddressesFromText(imageText);
        if (imageExtractedAddresses.length > 0) {
          addLog(`Extracted ${imageExtractedAddresses.length} addresses from page ${pageNum} image`);
          return imageExtractedAddresses;
        }
      } else {
        addLog(`No text extracted from page ${pageNum} image`);
      }
    } else {
      addLog(`Failed to generate image for page ${pageNum} for OCR processing`);
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
      addLog(`Generated image for page ${pageNum} OCR processing, size: ${Math.round(pageImage.length / 1024)}KB`);
      // Use extractTextFromImageWithOCR instead of extractTextFromImage
      const imageText = await extractTextFromImageWithOCR(pageImage);
      if (imageText) {
        addLog(`OCR text extracted from page ${pageNum} image: ${imageText.length} characters`);
        const imageExtractedEmployments = extractEmploymentsFromText(imageText);
        if (imageExtractedEmployments.length > 0) {
          addLog(`Extracted ${imageExtractedEmployments.length} employment records from page ${pageNum} image`);
          return imageExtractedEmployments;
        }
      } else {
        addLog(`No text extracted from page ${pageNum} image`);
      }
    } else {
      addLog(`Failed to generate image for page ${pageNum} for OCR processing`);
    }
    
    return [];
  } catch (error) {
    addLog(`Error extracting employments from page ${pageNum}: ${(error as Error).message}`);
    return [];
  }
};

// Enhanced address extraction function: Detects addresses in different formats
export const extractAddressesFromText = (text: string): AddressInfo[] => {
  const addresses: AddressInfo[] = [];
  
  try {
    // NEW: Look for a table structure with headers "Address", "Status", "Date Reported"
    // This pattern specifically targets the example format shown in the first image
    const tablePattern = text.match(/Address\s*Status\s*Date\s+Reported([\s\S]*?)(?:Employment|Alert|Other|You currently|$)/i);
    
    if (tablePattern && tablePattern[1]) {
      addLog("Found address table pattern with headers");
      const tableContent = tablePattern[1];
      
      // Extract each row from the table
      const rows = tableContent.split(/\n(?=\d+|[A-Z]+\s+[A-Z]+)/);
      
      for (const row of rows) {
        // Check if this row contains an address pattern and a status word
        if ((/\d+\s+[A-Z0-9]+/i.test(row) || /[A-Z]+\s+[A-Z]+/i.test(row)) && 
            (/current|former/i.test(row))) {
          
          // Try to extract address, status, and date
          const statusMatch = row.match(/(current|former)/i);
          const dateMatch = row.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/i);
          
          if (statusMatch) {
            const status = statusMatch[1].charAt(0).toUpperCase() + statusMatch[1].slice(1).toLowerCase();
            
            // Extract address by removing status and date parts
            let addressText = row;
            if (statusMatch) {
              addressText = addressText.replace(new RegExp(statusMatch[0], 'i'), '  ');
            }
            if (dateMatch) {
              addressText = addressText.replace(new RegExp(dateMatch[0], 'i'), '  ');
            }
            
            // Clean up the address
            addressText = addressText.trim().replace(/\s+/g, ' ');
            
            // Only add if we have a non-empty address
            if (addressText && addressText.length > 5) {
              addresses.push({
                address: addressText,
                status: status,
                dateReported: dateMatch ? dateMatch[0] : ''
              });
            }
          }
        }
      }
    }
    
    // If we found addresses from the table pattern, return them
    if (addresses.length > 0) {
      addLog(`Extracted ${addresses.length} addresses from table pattern`);
      return addresses;
    }
    
    // Fallback: Look for standalone address patterns
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
    
    // NEW: Pattern for the format shown in the examples with "CITY, FL ZIP"
    const cityStateZipPattern = /(\d+\s+[A-Z0-9\s]+(?:CT|ST|AVE|RD|BLVD|DR|LN|CIR|WAY|PL)(?:\s+[A-Z0-9\s]+)?)\s+((?:APT|UNIT|#)\s+[A-Z0-9]+)?\s+([A-Z\s]+),\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/gi;
    
    while ((match = cityStateZipPattern.exec(text)) !== null) {
      const streetAddress = match[1].trim();
      const unit = match[2] ? match[2].trim() : '';
      const city = match[3].trim();
      const state = match[4];
      const zip = match[5];
      
      const fullAddress = unit 
        ? `${streetAddress} ${unit}, ${city}, ${state} ${zip}`
        : `${streetAddress}, ${city}, ${state} ${zip}`;
      
      if (!addresses.some(a => a.address === fullAddress)) {
        const status = addresses.length === 0 ? "Current" : "Former";
        
        addresses.push({
          address: fullAddress,
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
    // NEW: Look for a table structure with headers "Company", "Occupation"
    // This pattern specifically targets the example format shown in the second image
    const tablePattern = text.match(/Company\s*Occupation([\s\S]*?)(?:Other|Information|Alert|You currently|$)/i);
    
    if (tablePattern && tablePattern[1]) {
      addLog("Found employment table pattern with headers");
      const tableContent = tablePattern[1];
      
      // Process the table content by lines
      const lines = tableContent.split('\n').filter(line => line.trim().length > 0);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip lines that are likely to be headers or section titles
        if (/employment\s+history|section contains/i.test(line)) {
          continue;
        }
        
        // If this line doesn't contain occupation data but the next might, combine them
        if (i < lines.length - 1 && line.length > 2) {
          const company = line;
          const occupation = lines[i+1].trim();
          
          // Check if the next line looks like an occupation (not a header or new company)
          if (occupation && 
              !occupation.includes(':') && 
              !/company|employer|employment/i.test(occupation) && 
              occupation.length < company.length * 2) {
            
            employments.push({
              company,
              occupation
            });
            
            // Skip the next line as we've already used it
            i++;
            continue;
          }
        }
        
        // Check if this single line contains employment data
        if (line.length > 2 && !/history|section contains/i.test(line.toLowerCase())) {
          employments.push({
            company: line,
            occupation: ""
          });
        }
      }
    }
    
    // If we found employments from the table pattern, return them
    if (employments.length > 0) {
      addLog(`Extracted ${employments.length} employments from table pattern`);
      return employments;
    }
    
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
