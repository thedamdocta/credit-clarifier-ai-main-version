
// Array to store contact table images for debugging
let contactTableImages: string[] = [];
let extractedPageNumbers: number[] = [];
let debugLogs: string[] = []; // New array to store debug logs

// Function to retrieve the table images for display
export const getContactTableImages = (): string[] => {
  return contactTableImages;
};

// Function to retrieve extracted page numbers
export const getExtractedPageNumbers = (): number[] => {
  return extractedPageNumbers;
};

// Function to retrieve debug logs
export const getContactExtractionLogs = (): string[] => {
  return debugLogs;
};

// Helper function to log and save debug information
const logDebug = (message: string) => {
  console.log(`[ContactInfo] ${message}`);
  debugLogs.push(message);
  // Limit log size to prevent memory issues
  if (debugLogs.length > 100) {
    debugLogs.shift();
  }
};

// Define the shape of address information
export interface AddressInfo {
  address: string;
  status: string;
  dateReported: string;
}

// Define the shape of employment information
export interface EmploymentInfo {
  company: string;
  occupation: string;
}

/**
 * Extract address and employment tables from the PDF document
 * @param pdfDocument The PDF document to extract from
 * @returns Object containing addresses and employments arrays
 */
export const extractContactInfoTables = async (pdfDocument: any): Promise<{
  addresses: AddressInfo[];
  employments: EmploymentInfo[];
  pageNumbers: number[];
}> => {
  // Reset stored data on new extraction
  contactTableImages = [];
  extractedPageNumbers = [];
  debugLogs = [];
  
  // Initialize empty arrays
  const addresses: AddressInfo[] = [];
  const employments: EmploymentInfo[] = [];
  
  try {
    logDebug("Extracting contact information tables from PDF");
    
    // Store the total number of pages to process
    const numPages = pdfDocument.numPages;
    logDebug(`PDF has ${numPages} pages`);
    
    // First pass - look for the specific pages that might contain contact information
    const candidatePages = await findContactInfoPages(pdfDocument, numPages);
    
    if (candidatePages.addressPages.length > 0 || candidatePages.employmentPages.length > 0) {
      logDebug("Found candidate pages for extraction: " + 
               `Addresses: ${candidatePages.addressPages.join(', ')}, ` +
               `Employment: ${candidatePages.employmentPages.join(', ')}`);
      
      // Extract addresses from candidate pages
      if (candidatePages.addressPages.length > 0) {
        const extractedAddresses = await extractAddressesFromPages(
          pdfDocument, 
          candidatePages.addressPages
        );
        addresses.push(...extractedAddresses);
        
        // Track the pages we extracted from
        extractedPageNumbers.push(...candidatePages.addressPages);
      }
      
      // Extract employment from candidate pages
      if (candidatePages.employmentPages.length > 0) {
        const extractedEmployments = await extractEmploymentsFromPages(
          pdfDocument,
          candidatePages.employmentPages
        );
        employments.push(...extractedEmployments);
        
        // Add employment pages to tracking if not already included
        for (const page of candidatePages.employmentPages) {
          if (!extractedPageNumbers.includes(page)) {
            extractedPageNumbers.push(page);
          }
        }
      }
    } else {
      // If no candidate pages found, try a different approach
      logDebug("No specific contact info pages found, attempting full document scan");
      
      // Try each page to find any that might contain contact info
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        logDebug(`Scanning page ${pageNum} for contact information`);
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        
        // Check if the page contains address-related keywords
        if (containsAddressKeywords(pageText)) {
          logDebug(`Page ${pageNum} may contain address information`);
          
          try {
            // Attempt to extract address information from this page
            const pageAddresses = await extractAddressesFromPage(
              pdfDocument, 
              pageNum
            );
            if (pageAddresses.length > 0) {
              logDebug(`Found ${pageAddresses.length} addresses on page ${pageNum}`);
              addresses.push(...pageAddresses);
              if (!extractedPageNumbers.includes(pageNum)) {
                extractedPageNumbers.push(pageNum);
              }
            } else {
              logDebug(`No addresses found on page ${pageNum}`);
            }
          } catch (error) {
            logDebug(`Error extracting addresses from page ${pageNum}: ${error}`);
          }
        }
        
        // Check if the page contains employment-related keywords
        if (containsEmploymentKeywords(pageText)) {
          logDebug(`Page ${pageNum} may contain employment information`);
          
          try {
            // Attempt to extract employment information from this page
            const pageEmployments = await extractEmploymentsFromPage(
              pdfDocument, 
              pageNum
            );
            if (pageEmployments.length > 0) {
              logDebug(`Found ${pageEmployments.length} employment entries on page ${pageNum}`);
              employments.push(...pageEmployments);
              if (!extractedPageNumbers.includes(pageNum)) {
                extractedPageNumbers.push(pageNum);
              }
            } else {
              logDebug(`No employment information found on page ${pageNum}`);
            }
          } catch (error) {
            logDebug(`Error extracting employment from page ${pageNum}: ${error}`);
          }
        }
      }
    }
    
    // Return the combined results
    logDebug(`Extraction complete. Found ${addresses.length} addresses and ${employments.length} employment entries`);
    logDebug(`Extracted from pages: ${extractedPageNumbers.join(', ')}`);
    logDebug(`Generated ${contactTableImages.length} table images`);
    
    return { 
      addresses, 
      employments, 
      pageNumbers: extractedPageNumbers 
    };
  } catch (error) {
    logDebug(`Error extracting contact info tables: ${error}`);
    return { 
      addresses, 
      employments, 
      pageNumbers: extractedPageNumbers 
    };
  }
};

/**
 * Find candidate pages for contact information extraction
 */
const findContactInfoPages = async (
  pdfDocument: any,
  numPages: number
): Promise<{ addressPages: number[]; employmentPages: number[] }> => {
  const addressPages: number[] = [];
  const employmentPages: number[] = [];
  
  // Loop through each page to find relevant keywords
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      
      // Check for address-related keywords
      if (containsAddressKeywords(pageText)) {
        logDebug(`Page ${pageNum} contains address keywords`);
        addressPages.push(pageNum);
      }
      
      // Check for employment-related keywords
      if (containsEmploymentKeywords(pageText)) {
        logDebug(`Page ${pageNum} contains employment keywords`);
        employmentPages.push(pageNum);
      }
    } catch (error) {
      logDebug(`Error processing page ${pageNum}: ${error}`);
    }
  }
  
  return { addressPages, employmentPages };
};

/**
 * Extract address information from text using regex
 */
const extractAddressesFromText = (text: string): AddressInfo[] => {
  const addresses: AddressInfo[] = [];
  
  // Log the text we're analyzing
  logDebug(`Analyzing text for address information (${text.length} characters)`);
  
  // Regex to find address patterns
  const addressRegex = /(\d+\s+[A-Za-z]+\s+(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|CT|COURT|CIR|CIRCLE|WAY|TER|TERRACE|PL|PLACE)\.?\s+(?:[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?|[A-Za-z\s]+))/g;
  
  let match;
  while ((match = addressRegex.exec(text)) !== null) {
    const address = match[0].trim();
    logDebug(`Found address pattern: ${address}`);
    addresses.push({
      address: address,
      status: "Reported",
      dateReported: new Date().toLocaleDateString()
    });
  }
  
  logDebug(`Extracted ${addresses.length} addresses from text`);
  return addresses;
};

/**
 * Extract employment information from text using regex
 */
const extractEmploymentsFromText = (text: string): EmploymentInfo[] => {
  const employments: EmploymentInfo[] = [];
  
  // Log the text we're analyzing
  logDebug(`Analyzing text for employment information (${text.length} characters)`);
  
  // Look for specific patterns indicating employment information
  const employmentSections = text.match(/employer.*?:.*?([^\.\n]+)/gi);
  const occupationSections = text.match(/occupation.*?:.*?([^\.\n]+)/gi);
  
  if (employmentSections && employmentSections.length > 0) {
    logDebug(`Found ${employmentSections.length} employer patterns in text`);
    
    employmentSections.forEach((section, index) => {
      const companyMatch = section.match(/(?:employer|employment)\s*:?\s*(.+)/i);
      if (companyMatch && companyMatch[1]) {
        const company = companyMatch[1].trim();
        
        // Try to find corresponding occupation
        let occupation = "";
        if (occupationSections && occupationSections[index]) {
          const occupationMatch = occupationSections[index].match(/occupation\s*:?\s*(.+)/i);
          if (occupationMatch && occupationMatch[1]) {
            occupation = occupationMatch[1].trim();
          }
        }
        
        logDebug(`Found employment: Company: "${company}", Occupation: "${occupation || 'Unknown'}"`);
        
        employments.push({
          company: company,
          occupation: occupation || "Unknown"
        });
      }
    });
  } else {
    // More generic pattern if specific ones fail
    const employmentRegex = /(?:employer|employment):?\s*([^\.]+)/gi;
    
    let match;
    while ((match = employmentRegex.exec(text)) !== null) {
      const company = match[1].trim();
      logDebug(`Found generic employment match: ${company}`);
      employments.push({
        company: company,
        occupation: "Unknown"
      });
    }
  }
  
  // If we didn't find anything with the main patterns, check for headings
  if (employments.length === 0) {
    // Look for employment history section
    const historyMatch = text.match(/employment history[\s\n]*([^\.]+)/i);
    if (historyMatch && historyMatch[1] && !historyMatch[1].includes('history is the information')) {
      const company = historyMatch[1].trim();
      logDebug(`Found employment from history section: ${company}`);
      employments.push({
        company: company,
        occupation: "Unknown"
      });
    }
  }
  
  logDebug(`Extracted ${employments.length} employment entries from text`);
  return employments;
};

/**
 * Process rows from the extracted table into address objects
 */
const processAddressRows = (rows: any[]): AddressInfo[] => {
  const addresses: AddressInfo[] = [];
  
  logDebug(`Processing ${rows.length} rows for address information`);
  
  for (const row of rows) {
    if (row && row.length >= 3) {
      // Assuming the first column is the address, second is status, and third is date
      const address = row[0] || '';
      const status = row[1] || 'Reported';
      const dateReported = row[2] || new Date().toLocaleDateString();
      
      if (address) {
        logDebug(`Found address in table: ${address}`);
        addresses.push({
          address: address,
          status: status,
          dateReported: dateReported
        });
      }
    } else if (row && row.length > 0 && row[0]) {
      // If we just have one column, assume it's the address
      const address = row[0];
      logDebug(`Found single-column address in table: ${address}`);
      addresses.push({
        address: address,
        status: 'Reported',
        dateReported: new Date().toLocaleDateString()
      });
    }
  }
  
  return addresses;
};

/**
 * Process rows from the extracted table into employment objects
 */
const processEmploymentRows = (rows: any[]): EmploymentInfo[] => {
  const employments: EmploymentInfo[] = [];
  
  logDebug(`Processing ${rows.length} rows for employment information`);
  
  for (const row of rows) {
    if (row && row.length >= 2) {
      // Assuming the first column is the company and second is the occupation
      const company = row[0] || '';
      const occupation = row[1] || 'Unknown';
      
      if (company) {
        logDebug(`Found employment in table: ${company} (${occupation})`);
        employments.push({
          company: company,
          occupation: occupation
        });
      }
    } else if (row && row.length > 0 && row[0]) {
      // If we just have one column, assume it's the company
      const company = row[0];
      logDebug(`Found single-column employment in table: ${company}`);
      employments.push({
        company: company,
        occupation: 'Unknown'
      });
    }
  }
  
  return employments;
};

/**
 * Helper function to check if text contains address-related keywords
 */
const containsAddressKeywords = (text: string): boolean => {
  const addressKeywords = [
    'address', 'addresses', 'residence', 'location',
    'previous address', 'current address', 'former address',
    'city', 'state', 'zip', 'postal', 'street'
  ];
  
  const lowerText = text.toLowerCase();
  const found = addressKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  
  if (found) {
    logDebug(`Address keywords found in text`);
  }
  
  return found;
};

/**
 * Helper function to check if text contains employment-related keywords
 */
const containsEmploymentKeywords = (text: string): boolean => {
  const employmentKeywords = [
    'employment', 'employer', 'occupation', 'job',
    'work', 'career', 'profession', 'position',
    'employed', 'company', 'business'
  ];
  
  const lowerText = text.toLowerCase();
  const found = employmentKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
  
  if (found) {
    logDebug(`Employment keywords found in text`);
  }
  
  return found;
};

/**
 * Convert PDF page to image for better text extraction
 */
const convertPDFPageToImage = async (pdfDocument: any, pageNum: number): Promise<string | null> => {
  try {
    logDebug(`Converting page ${pageNum} to image`);
    const { convertPDFPageToImage } = await import('../../utils/pdf/pdfToImage');
    const result = await convertPDFPageToImage(pdfDocument, pageNum);
    if (result) {
      logDebug(`Successfully converted page ${pageNum} to image`);
      return result;
    } else {
      logDebug(`Failed to convert page ${pageNum} to image`);
      return null;
    }
  } catch (error) {
    logDebug(`Error converting page ${pageNum} to image: ${error}`);
    return null;
  }
};

/**
 * Extract table data using OpenAI
 */
const extractTableWithOpenAI = async (imageUrl: string): Promise<any> => {
  try {
    logDebug(`Extracting table from image with AI`);
    const { extractTableFromImage } = await import('./tableExtraction');
    const result = await extractTableFromImage(imageUrl);
    if (result) {
      logDebug(`Successfully extracted table data: ${result.rows?.length || 0} rows`);
      return result;
    } else {
      logDebug(`Failed to extract table data`);
      return null;
    }
  } catch (error) {
    logDebug(`Error extracting table with OpenAI: ${error}`);
    return null;
  }
};

/**
 * Extract addresses from multiple PDF pages
 */
const extractAddressesFromPages = async (pdfDocument: any, pageNumbers: number[]): Promise<AddressInfo[]> => {
  const addresses: AddressInfo[] = [];
  
  logDebug(`Attempting to extract addresses from ${pageNumbers.length} pages: ${pageNumbers.join(', ')}`);
  
  for (const pageNum of pageNumbers) {
    try {
      const pageAddresses = await extractAddressesFromPage(pdfDocument, pageNum);
      if (pageAddresses.length > 0) {
        logDebug(`Found ${pageAddresses.length} addresses on page ${pageNum}`);
        addresses.push(...pageAddresses);
      } else {
        logDebug(`No addresses found on page ${pageNum}`);
      }
    } catch (error) {
      logDebug(`Error extracting addresses from page ${pageNum}: ${error}`);
    }
  }
  
  return addresses;
};

/**
 * Extract employments from multiple PDF pages
 */
const extractEmploymentsFromPages = async (pdfDocument: any, pageNumbers: number[]): Promise<EmploymentInfo[]> => {
  const employments: EmploymentInfo[] = [];
  
  logDebug(`Attempting to extract employments from ${pageNumbers.length} pages: ${pageNumbers.join(', ')}`);
  
  for (const pageNum of pageNumbers) {
    try {
      const pageEmployments = await extractEmploymentsFromPage(pdfDocument, pageNum);
      if (pageEmployments.length > 0) {
        logDebug(`Found ${pageEmployments.length} employments on page ${pageNum}`);
        employments.push(...pageEmployments);
      } else {
        logDebug(`No employments found on page ${pageNum}`);
      }
    } catch (error) {
      logDebug(`Error extracting employments from page ${pageNum}: ${error}`);
    }
  }
  
  return employments;
};

/**
 * Extract addresses from a single PDF page
 */
const extractAddressesFromPage = async (pdfDocument: any, pageNum: number): Promise<AddressInfo[]> => {
  logDebug(`Attempting to extract addresses from page ${pageNum}`);
  
  try {
    // First, try to extract text directly from the page
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    
    // Try to extract addresses from text first
    const textAddresses = extractAddressesFromText(pageText);
    if (textAddresses.length > 0) {
      logDebug(`Found ${textAddresses.length} addresses in text of page ${pageNum}`);
      return textAddresses;
    }
    
    // If no addresses found in text, try image-based extraction
    logDebug(`No addresses found in text, attempting image extraction for page ${pageNum}`);
    const imageUrl = await convertPDFPageToImage(pdfDocument, pageNum);
    
    if (imageUrl) {
      // Store the image for debugging
      contactTableImages.push(imageUrl);
      logDebug(`Added page ${pageNum} image to debug images (total: ${contactTableImages.length})`);
      
      // Try to extract table data from the image
      const tableData = await extractTableWithOpenAI(imageUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        logDebug(`Successfully extracted table data from page ${pageNum}`);
        return processAddressRows(tableData.rows);
      } else {
        logDebug(`No table data extracted from page ${pageNum} image`);
      }
    } else {
      logDebug(`Failed to convert page ${pageNum} to image`);
    }
    
    // If both methods failed, return empty array
    logDebug(`No addresses found on page ${pageNum}`);
    return [];
    
  } catch (error) {
    logDebug(`Error in extractAddressesFromPage for page ${pageNum}: ${error}`);
    return [];
  }
};

/**
 * Extract employments from a single PDF page
 */
const extractEmploymentsFromPage = async (pdfDocument: any, pageNum: number): Promise<EmploymentInfo[]> => {
  logDebug(`Attempting to extract employments from page ${pageNum}`);
  
  try {
    // First, try to extract text directly from the page
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    
    // Try to extract employments from text first
    const textEmployments = extractEmploymentsFromText(pageText);
    if (textEmployments.length > 0) {
      logDebug(`Found ${textEmployments.length} employments in text of page ${pageNum}`);
      return textEmployments;
    }
    
    // If no employments found in text, try image-based extraction
    logDebug(`No employments found in text, attempting image extraction for page ${pageNum}`);
    const imageUrl = await convertPDFPageToImage(pdfDocument, pageNum);
    
    if (imageUrl) {
      // Store the image for debugging if not already added
      if (!contactTableImages.includes(imageUrl)) {
        contactTableImages.push(imageUrl);
        logDebug(`Added page ${pageNum} image to debug images (total: ${contactTableImages.length})`);
      }
      
      // Try to extract table data from the image
      const tableData = await extractTableWithOpenAI(imageUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        logDebug(`Successfully extracted table data from page ${pageNum}`);
        return processEmploymentRows(tableData.rows);
      } else {
        logDebug(`No table data extracted from page ${pageNum} image`);
      }
    } else {
      logDebug(`Failed to convert page ${pageNum} to image`);
    }
    
    // If both methods failed, return empty array
    logDebug(`No employments found on page ${pageNum}`);
    return [];
    
  } catch (error) {
    logDebug(`Error in extractEmploymentsFromPage for page ${pageNum}: ${error}`);
    return [];
  }
};
