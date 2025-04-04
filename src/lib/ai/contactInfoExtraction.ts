
// Array to store contact table images for debugging
let contactTableImages: string[] = [];
let extractedPageNumbers: number[] = [];

// Function to retrieve the table images for display
export const getContactTableImages = (): string[] => {
  return contactTableImages;
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
  // Reset stored images on new extraction
  contactTableImages = [];
  extractedPageNumbers = [];
  
  // Initialize empty arrays
  const addresses: AddressInfo[] = [];
  const employments: EmploymentInfo[] = [];
  
  try {
    console.log("Extracting contact information tables from PDF");
    
    // Store the total number of pages to process
    const numPages = pdfDocument.numPages;
    console.log(`PDF has ${numPages} pages`);
    
    // First pass - look for the specific pages that might contain contact information
    const candidatePages = await findContactInfoPages(pdfDocument, numPages);
    
    if (candidatePages.addressPages.length > 0 || candidatePages.employmentPages.length > 0) {
      console.log("Found candidate pages for extraction:", candidatePages);
      
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
      console.log("No specific contact info pages found, attempting full document scan");
      
      // Try each page to find any that might contain contact info
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        
        // Check if the page contains address-related keywords
        if (containsAddressKeywords(pageText)) {
          console.log(`Page ${pageNum} may contain address information`);
          
          try {
            // Attempt to extract address information from this page
            const pageAddresses = await extractAddressesFromPage(
              pdfDocument, 
              pageNum
            );
            if (pageAddresses.length > 0) {
              addresses.push(...pageAddresses);
              if (!extractedPageNumbers.includes(pageNum)) {
                extractedPageNumbers.push(pageNum);
              }
            }
          } catch (error) {
            console.error(`Error extracting addresses from page ${pageNum}:`, error);
          }
        }
        
        // Check if the page contains employment-related keywords
        if (containsEmploymentKeywords(pageText)) {
          console.log(`Page ${pageNum} may contain employment information`);
          
          try {
            // Attempt to extract employment information from this page
            const pageEmployments = await extractEmploymentsFromPage(
              pdfDocument, 
              pageNum
            );
            if (pageEmployments.length > 0) {
              employments.push(...pageEmployments);
              if (!extractedPageNumbers.includes(pageNum)) {
                extractedPageNumbers.push(pageNum);
              }
            }
          } catch (error) {
            console.error(`Error extracting employment from page ${pageNum}:`, error);
          }
        }
      }
    }
    
    // Return the combined results
    return { 
      addresses, 
      employments, 
      pageNumbers: extractedPageNumbers 
    };
  } catch (error) {
    console.error("Error extracting contact info tables:", error);
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
        console.log(`Page ${pageNum} contains address keywords`);
        addressPages.push(pageNum);
      }
      
      // Check for employment-related keywords
      if (containsEmploymentKeywords(pageText)) {
        console.log(`Page ${pageNum} contains employment keywords`);
        employmentPages.push(pageNum);
      }
    } catch (error) {
      console.error(`Error processing page ${pageNum}:`, error);
    }
  }
  
  return { addressPages, employmentPages };
};

/**
 * Extract address information from text using regex
 */
const extractAddressesFromText = (text: string): AddressInfo[] => {
  const addresses: AddressInfo[] = [];
  
  // Regex to find address patterns
  const addressRegex = /(\d+\s+[A-Za-z]+\s+(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|CT|COURT|CIR|CIRCLE|WAY|TER|TERRACE|PL|PLACE)\.?\s+(?:[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?|[A-Za-z\s]+))/g;
  
  let match;
  while ((match = addressRegex.exec(text)) !== null) {
    const address = match[0].trim();
    addresses.push({
      address: address,
      status: "Reported",
      dateReported: new Date().toLocaleDateString()
    });
  }
  
  return addresses;
};

/**
 * Extract employment information from text using regex
 */
const extractEmploymentsFromText = (text: string): EmploymentInfo[] => {
  const employments: EmploymentInfo[] = [];
  
  // Regex to find employment patterns
  const employmentRegex = /(?:employer|employment):?\s*([^\.]+)/gi;
  
  let match;
  while ((match = employmentRegex.exec(text)) !== null) {
    const company = match[1].trim();
    employments.push({
      company: company,
      occupation: "Unknown"
    });
  }
  
  return employments;
};

/**
 * Process rows from the extracted table into address objects
 */
const processAddressRows = (rows: any[]): AddressInfo[] => {
  const addresses: AddressInfo[] = [];
  
  for (const row of rows) {
    if (row && row.length >= 3) {
      // Assuming the first column is the address, second is status, and third is date
      const address = row[0] || '';
      const status = row[1] || 'Reported';
      const dateReported = row[2] || new Date().toLocaleDateString();
      
      if (address) {
        addresses.push({
          address: address,
          status: status,
          dateReported: dateReported
        });
      }
    }
  }
  
  return addresses;
};

/**
 * Process rows from the extracted table into employment objects
 */
const processEmploymentRows = (rows: any[]): EmploymentInfo[] => {
  const employments: EmploymentInfo[] = [];
  
  for (const row of rows) {
    if (row && row.length >= 2) {
      // Assuming the first column is the company and second is the occupation
      const company = row[0] || '';
      const occupation = row[1] || 'Unknown';
      
      if (company) {
        employments.push({
          company: company,
          occupation: occupation
        });
      }
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
  return addressKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
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
  return employmentKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
};

/**
 * Convert PDF page to image for better text extraction
 */
const convertPDFPageToImage = async (pdfDocument: any, pageNum: number): Promise<string | null> => {
  try {
    const { convertPDFPageToImage } = await import('../../utils/pdf/pdfToImage');
    return await convertPDFPageToImage(pdfDocument, pageNum);
  } catch (error) {
    console.error(`Error converting page ${pageNum} to image:`, error);
    return null;
  }
};

/**
 * Extract table data using OpenAI
 */
const extractTableWithOpenAI = async (imageUrl: string): Promise<any> => {
  try {
    const { extractTableFromImage } = await import('./tableExtraction');
    return await extractTableFromImage(imageUrl);
  } catch (error) {
    console.error("Error extracting table with OpenAI:", error);
    return null;
  }
};

/**
 * Extract addresses from multiple PDF pages
 */
const extractAddressesFromPages = async (pdfDocument: any, pageNumbers: number[]): Promise<AddressInfo[]> => {
  const addresses: AddressInfo[] = [];
  
  for (const pageNum of pageNumbers) {
    try {
      const pageAddresses = await extractAddressesFromPage(pdfDocument, pageNum);
      addresses.push(...pageAddresses);
    } catch (error) {
      console.error(`Error extracting addresses from page ${pageNum}:`, error);
    }
  }
  
  return addresses;
};

/**
 * Extract employments from multiple PDF pages
 */
const extractEmploymentsFromPages = async (pdfDocument: any, pageNumbers: number[]): Promise<EmploymentInfo[]> => {
  const employments: EmploymentInfo[] = [];
  
  for (const pageNum of pageNumbers) {
    try {
      const pageEmployments = await extractEmploymentsFromPage(pdfDocument, pageNum);
      employments.push(...pageEmployments);
    } catch (error) {
      console.error(`Error extracting employments from page ${pageNum}:`, error);
    }
  }
  
  return employments;
};

/**
 * Extract addresses from a single PDF page
 */
const extractAddressesFromPage = async (pdfDocument: any, pageNum: number): Promise<AddressInfo[]> => {
  console.log(`Attempting to extract addresses from page ${pageNum}`);
  
  try {
    // First, try to extract text directly from the page
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    
    // Try to extract addresses from text first
    const textAddresses = extractAddressesFromText(pageText);
    if (textAddresses.length > 0) {
      console.log(`Found ${textAddresses.length} addresses in text of page ${pageNum}`);
      return textAddresses;
    }
    
    // If no addresses found in text, try image-based extraction
    console.log(`No addresses found in text, attempting image extraction for page ${pageNum}`);
    const imageUrl = await convertPDFPageToImage(pdfDocument, pageNum);
    
    if (imageUrl) {
      // Store the image for debugging
      contactTableImages.push(imageUrl);
      
      // Try to extract table data from the image
      const tableData = await extractTableWithOpenAI(imageUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        console.log(`Successfully extracted table data from page ${pageNum}`);
        return processAddressRows(tableData.rows);
      }
    }
    
    // If both methods failed, return empty array
    console.log(`No addresses found on page ${pageNum}`);
    return [];
    
  } catch (error) {
    console.error(`Error in extractAddressesFromPage for page ${pageNum}:`, error);
    return [];
  }
};

/**
 * Extract employments from a single PDF page
 */
const extractEmploymentsFromPage = async (pdfDocument: any, pageNum: number): Promise<EmploymentInfo[]> => {
  console.log(`Attempting to extract employments from page ${pageNum}`);
  
  try {
    // First, try to extract text directly from the page
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    
    // Try to extract employments from text first
    const textEmployments = extractEmploymentsFromText(pageText);
    if (textEmployments.length > 0) {
      console.log(`Found ${textEmployments.length} employments in text of page ${pageNum}`);
      return textEmployments;
    }
    
    // If no employments found in text, try image-based extraction
    console.log(`No employments found in text, attempting image extraction for page ${pageNum}`);
    const imageUrl = await convertPDFPageToImage(pdfDocument, pageNum);
    
    if (imageUrl) {
      // Store the image for debugging if not already added
      if (!contactTableImages.includes(imageUrl)) {
        contactTableImages.push(imageUrl);
      }
      
      // Try to extract table data from the image
      const tableData = await extractTableWithOpenAI(imageUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        console.log(`Successfully extracted table data from page ${pageNum}`);
        return processEmploymentRows(tableData.rows);
      }
    }
    
    // If both methods failed, return empty array
    console.log(`No employments found on page ${pageNum}`);
    return [];
    
  } catch (error) {
    console.error(`Error in extractEmploymentsFromPage for page ${pageNum}:`, error);
    return [];
  }
};
