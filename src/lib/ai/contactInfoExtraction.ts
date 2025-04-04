
import { toast } from "sonner";
import { extractRegionFromPDFPage } from "@/utils/pdf/pdfToImage";
import { canUseOpenAI } from "./openai/openaiService";
import { processImageWithEnhancedOCR } from "./ocrExtraction";

// Interface for address information
export interface AddressInfo {
  address: string;
  status: string;
  dateReported: string;
}

// Interface for employment information
export interface EmploymentInfo {
  company: string;
  occupation: string;
}

// Store extracted table images for debugging
let contactTableImages: string[] = [];

// Function to get extracted table images
export const getContactTableImages = (): string[] => {
  return contactTableImages;
};

// Reset table images
export const resetContactTableImages = (): void => {
  contactTableImages = [];
};

// Add a table image to the collection
export const addContactTableImage = (imageUrl: string): void => {
  if (!contactTableImages.includes(imageUrl)) {
    contactTableImages.push(imageUrl);
  }
};

/**
 * Main function to extract contact information tables from the PDF
 */
export const extractContactInfoTables = async (pdfDocument: any): Promise<{
  addresses: AddressInfo[];
  employments: EmploymentInfo[];
}> => {
  try {
    console.log("Starting contact information table extraction");
    
    // Reset table images
    resetContactTableImages();
    
    // Initialize return data
    const result = {
      addresses: [] as AddressInfo[],
      employments: [] as EmploymentInfo[]
    };
    
    if (!pdfDocument) {
      console.error("No PDF document available for contact info extraction");
      return result;
    }
    
    const numPages = pdfDocument.numPages;
    
    // First try to find the addresses and employment tables (usually on first 10 pages)
    let addressesImage: string | null = null;
    let employmentImage: string | null = null;
    
    // Keywords to identify contact info section
    const addressKeywords = [
      'contact information',
      'address',
      'addresses',
      'current address',
      'former address'
    ];
    
    const employmentKeywords = [
      'employment history',
      'employment',
      'employer',
      'occupation'
    ];
    
    // Check pages for contact info tables
    for (let i = 1; i <= Math.min(10, numPages); i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
        
        // Look for address section keywords
        const hasAddressKeywords = addressKeywords.some(keyword => pageText.includes(keyword));
        if (!addressesImage && hasAddressKeywords) {
          console.log(`Found possible address section on page ${i}`);
          
          // Extract address table
          if (pageText.includes("address") && pageText.includes("status") && pageText.includes("date reported")) {
            console.log(`Found address table on page ${i}`);
            // Try to extract the whole address table
            const addressTableRegion = { x: 50, y: 200, width: 900, height: 400 };
            addressesImage = await extractRegionFromPDFPage(pdfDocument, i, addressTableRegion);
          } else {
            // Try to extract part of the page where addresses usually are
            const addressRegion = { x: 50, y: 150, width: 900, height: 300 };
            addressesImage = await extractRegionFromPDFPage(pdfDocument, i, addressRegion);
          }
          
          if (addressesImage) {
            console.log("Successfully extracted address image");
            addContactTableImage(addressesImage);
          }
        }
        
        // Look for employment section keywords
        const hasEmploymentKeywords = employmentKeywords.some(keyword => pageText.includes(keyword));
        if (!employmentImage && hasEmploymentKeywords) {
          console.log(`Found possible employment section on page ${i}`);
          
          // Try to extract employment table
          if (pageText.includes("company") && pageText.includes("occupation")) {
            console.log(`Found employment table on page ${i}`);
            // Try to extract the whole employment table
            const employmentTableRegion = { x: 50, y: 350, width: 900, height: 200 };
            employmentImage = await extractRegionFromPDFPage(pdfDocument, i, employmentTableRegion);
          } else {
            // Try to extract part of the page where employment usually is
            const employmentRegion = { x: 50, y: 350, width: 900, height: 150 };
            employmentImage = await extractRegionFromPDFPage(pdfDocument, i, employmentRegion);
          }
          
          if (employmentImage) {
            console.log("Successfully extracted employment image");
            addContactTableImage(employmentImage);
          }
        }
        
        // If both found, break early
        if (addressesImage && employmentImage) {
          break;
        }
      } catch (error) {
        console.error(`Error processing page ${i} for contact info:`, error);
      }
    }
    
    // Process address image if found
    if (addressesImage) {
      const addresses = await extractAddressesFromImage(addressesImage);
      if (addresses && addresses.length > 0) {
        result.addresses = addresses;
      }
    }
    
    // Process employment image if found
    if (employmentImage) {
      const employments = await extractEmploymentFromImage(employmentImage);
      if (employments && employments.length > 0) {
        result.employments = employments;
      }
    }
    
    // If still empty, try to extract from raw text in the PDF using a special fallback
    if (result.addresses.length === 0) {
      console.log("Using text-based fallback for address extraction");
      const addressesFromText = await extractAddressesFromText(pdfDocument);
      if (addressesFromText.length > 0) {
        result.addresses = addressesFromText;
      }
    }
    
    if (result.employments.length === 0) {
      console.log("Using text-based fallback for employment extraction");
      const employmentsFromText = await extractEmploymentsFromText(pdfDocument);
      if (employmentsFromText.length > 0) {
        result.employments = employmentsFromText;
      }
    }
    
    console.log("Contact information extraction complete:", result);
    return result;
    
  } catch (error) {
    console.error("Error extracting contact information tables:", error);
    return {
      addresses: [],
      employments: []
    };
  }
};

/**
 * Extract address information from image
 */
async function extractAddressesFromImage(imageUrl: string): Promise<AddressInfo[]> {
  try {
    console.log("Extracting addresses from image");
    
    // If OpenAI is available, use it for better extraction
    if (canUseOpenAI()) {
      const addresses = await extractAddressesWithOpenAI(imageUrl);
      if (addresses && addresses.length > 0) {
        return addresses;
      }
    }
    
    // Fallback to OCR
    const extractedText = await processImageWithEnhancedOCR(imageUrl);
    if (extractedText) {
      // Process text with regex for address patterns
      const addresses = parseAddressesFromText(extractedText);
      return addresses;
    }
    
    return [];
  } catch (error) {
    console.error("Error extracting addresses from image:", error);
    return [];
  }
}

/**
 * Extract employment information from image
 */
async function extractEmploymentFromImage(imageUrl: string): Promise<EmploymentInfo[]> {
  try {
    console.log("Extracting employment from image");
    
    // If OpenAI is available, use it for better extraction
    if (canUseOpenAI()) {
      const employments = await extractEmploymentWithOpenAI(imageUrl);
      if (employments && employments.length > 0) {
        return employments;
      }
    }
    
    // Fallback to OCR
    const extractedText = await processImageWithEnhancedOCR(imageUrl);
    if (extractedText) {
      // Process text with regex for employment patterns
      const employments = parseEmploymentFromText(extractedText);
      return employments;
    }
    
    return [];
  } catch (error) {
    console.error("Error extracting employment from image:", error);
    return [];
  }
}

/**
 * Extract addresses using OpenAI
 */
async function extractAddressesWithOpenAI(imageUrl: string): Promise<AddressInfo[]> {
  try {
    console.log("Using OpenAI to extract addresses");
    
    // Import here to avoid circular dependency
    const { extractTableWithOpenAI } = await import('./openai/openaiService');
    
    const prompt = `
      Extract the address information from this credit report image.
      Focus on the "Contact Information" section with columns: Address, Status, Date Reported.
      Return the data in a structured format with address, status, and dateReported fields.
    `;
    
    // FIX: Pass only the imageUrl parameter (removed the second argument)
    const extractedData = await extractTableWithOpenAI(imageUrl);
    
    // Type assertion to handle dynamic data from OpenAI
    if (extractedData && Array.isArray(extractedData)) {
      return extractedData
        .filter(item => item && typeof item === 'object')
        .map(item => {
          // Use type assertion to access dynamic properties safely
          const dataItem = item as Record<string, any>;
          return {
            address: String(dataItem.address || dataItem.value || dataItem.text || ''),
            status: String(dataItem.status || dataItem.type || ''),
            dateReported: String(dataItem.dateReported || dataItem.date || '')
          };
        })
        .filter(item => item.address); // Filter out items with empty addresses
    }
    
    return [];
  } catch (error) {
    console.error("Error using OpenAI for address extraction:", error);
    return [];
  }
}

/**
 * Extract employment using OpenAI
 */
async function extractEmploymentWithOpenAI(imageUrl: string): Promise<EmploymentInfo[]> {
  try {
    console.log("Using OpenAI to extract employment");
    
    // Import here to avoid circular dependency
    const { extractTableWithOpenAI } = await import('./openai/openaiService');
    
    const prompt = `
      Extract the employment information from this credit report image.
      Focus on the "Employment History" section with columns: Company and Occupation.
      Return the data in a structured format with company and occupation fields.
    `;
    
    // FIX: Pass only the imageUrl parameter (removed the second argument)
    const extractedData = await extractTableWithOpenAI(imageUrl);
    
    // Type assertion to handle dynamic data from OpenAI
    if (extractedData && Array.isArray(extractedData)) {
      return extractedData
        .filter(item => item && typeof item === 'object')
        .map(item => {
          // Use type assertion to access dynamic properties safely
          const dataItem = item as Record<string, any>;
          return {
            company: String(dataItem.company || dataItem.employer || dataItem.name || dataItem.value || ''),
            occupation: String(dataItem.occupation || dataItem.position || dataItem.title || dataItem.job || '')
          };
        })
        .filter(item => item.company); // Filter out items with empty company names
    }
    
    return [];
  } catch (error) {
    console.error("Error using OpenAI for employment extraction:", error);
    return [];
  }
}

/**
 * Parse addresses from extracted text using regex
 */
function parseAddressesFromText(text: string): AddressInfo[] {
  try {
    const addresses: AddressInfo[] = [];
    
    // Look for patterns like "Current: 123 Main St, City, State 12345 (Reported: Jan 2023)"
    const addressRegex = /(Current|Former)\s*:?\s*([^(]+)(?:\(Reported:?\s*([^)]+)\))?/gi;
    
    let match;
    while ((match = addressRegex.exec(text)) !== null) {
      const status = match[1] || "Unknown";
      const address = match[2]?.trim() || "";
      const dateReported = match[3]?.trim() || "";
      
      if (address) {
        addresses.push({
          status,
          address,
          dateReported
        });
      }
    }
    
    // If regex didn't find anything, try simpler pattern matching
    if (addresses.length === 0) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && (/\d+\s+[A-Za-z]/.test(line) || /street|avenue|road|drive|lane|way|court|circle/i.test(line))) {
          // This looks like an address
          const status = 
            /current/i.test(line) ? "Current" : 
            /former/i.test(line) ? "Former" : "Unknown";
          
          // Extract date if present
          const dateMatch = line.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/i) ||
                           line.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
          const dateReported = dateMatch ? dateMatch[0] : "";
          
          // Clean up the address text
          const address = line
            .replace(/current|former|reported|date/gi, '')
            .replace(dateMatch ? dateMatch[0] : '', '')
            .replace(/\s{2,}/g, ' ')
            .trim();
          
          if (address) {
            addresses.push({
              status,
              address,
              dateReported
            });
          }
        }
      }
    }
    
    return addresses;
  } catch (error) {
    console.error("Error parsing addresses from text:", error);
    return [];
  }
}

/**
 * Parse employment from extracted text using regex
 */
function parseEmploymentFromText(text: string): EmploymentInfo[] {
  try {
    const employments: EmploymentInfo[] = [];
    
    // Look for patterns like "Employer: ACME Corp - Software Developer"
    const employmentRegex = /(?:employer|employment|company)\s*:?\s*([^-\n]+)(?:\s*-\s*([^\n]+))?/gi;
    
    let match;
    while ((match = employmentRegex.exec(text)) !== null) {
      const company = match[1]?.trim() || "";
      const occupation = match[2]?.trim() || "";
      
      if (company) {
        employments.push({
          company,
          occupation
        });
      }
    }
    
    // If regex didn't find anything, try to extract from text
    if (employments.length === 0) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/employ|occupation|company/i.test(line)) {
          // This looks like employment info
          const parts = line.split(/[-:]/);
          if (parts.length >= 1) {
            const company = parts[0].replace(/employer|employment|company/i, '').trim();
            const occupation = parts.length > 1 ? parts[1].trim() : "";
            
            if (company) {
              employments.push({
                company,
                occupation
              });
            }
          }
        }
      }
    }
    
    return employments;
  } catch (error) {
    console.error("Error parsing employment from text:", error);
    return [];
  }
}

/**
 * Extract addresses directly from PDF text
 */
async function extractAddressesFromText(pdfDocument: any): Promise<AddressInfo[]> {
  try {
    const addresses: AddressInfo[] = [];
    
    // Look through first 10 pages for address tables
    for (let i = 1; i <= Math.min(10, pdfDocument.numPages); i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      
      // Look for address section indicators
      if (pageText.includes("Address") && 
          (pageText.includes("Status") || pageText.includes("Current") || pageText.includes("Former")) && 
          (pageText.includes("Date") || pageText.includes("Reported"))) {
        
        console.log(`Found address section text on page ${i}`);
        
        // Get text items with their positions for better parsing
        const items = textContent.items;
        
        // Group items into rows based on vertical position
        const rows: any[][] = [];
        let currentRow: any[] = [];
        let lastY = -1;
        
        items.forEach((item: any) => {
          // Detect new row based on Y position change
          if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
            if (currentRow.length > 0) {
              rows.push([...currentRow]);
              currentRow = [];
            }
          }
          
          currentRow.push(item);
          lastY = item.transform[5];
        });
        
        // Add the last row if not empty
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        
        // Process rows into addresses
        let foundAddressHeader = false;
        let addressCol = -1, statusCol = -1, dateCol = -1;
        
        for (let r = 0; r < rows.length; r++) {
          const rowText = rows[r].map((item: any) => item.str).join(" ");
          
          // Find header row to identify columns
          if (!foundAddressHeader && 
              rowText.includes("Address") && 
              (rowText.includes("Status") || rowText.includes("Current") || rowText.includes("Former")) && 
              (rowText.includes("Date") || rowText.includes("Reported"))) {
            
            foundAddressHeader = true;
            
            // Find column positions
            rows[r].forEach((item: any, idx: number) => {
              const text = item.str.toLowerCase();
              if (text.includes("address")) {
                addressCol = item.transform[4]; // X position
              }
              else if (text.includes("status")) {
                statusCol = item.transform[4]; // X position
              }
              else if (text.includes("date") || text.includes("reported")) {
                dateCol = item.transform[4]; // X position
              }
            });
            
            continue; // Skip header row
          }
          
          // Process data rows
          if (foundAddressHeader) {
            // Sort row items by X position
            const sortedItems = [...rows[r]].sort((a, b) => a.transform[4] - b.transform[4]);
            
            // Assign items to columns
            let address = "", status = "", dateReported = "";
            
            sortedItems.forEach((item: any) => {
              const x = item.transform[4];
              
              // Determine which column this item belongs to
              if (addressCol >= 0 && Math.abs(x - addressCol) < 100) {
                address += item.str + " ";
              }
              else if (statusCol >= 0 && Math.abs(x - statusCol) < 60) {
                status += item.str + " ";
              }
              else if (dateCol >= 0 && Math.abs(x - dateCol) < 60) {
                dateReported += item.str + " ";
              }
              // If columns aren't identified well, use position to guess
              else if (x < 300) {
                address += item.str + " ";
              }
              else if (x >= 300 && x < 500) {
                status += item.str + " ";
              }
              else {
                dateReported += item.str + " ";
              }
            });
            
            // Clean up extracted values
            address = address.trim();
            status = status.trim();
            dateReported = dateReported.trim();
            
            // Add to addresses if there's actual content
            if (address && (address.includes(" ") || address.match(/\d/))) {
              addresses.push({
                address,
                status: status || "Unknown",
                dateReported
              });
            }
          }
        }
        
        // If we found addresses, we can stop looking through pages
        if (addresses.length > 0) {
          break;
        }
      }
    }
    
    return addresses;
  } catch (error) {
    console.error("Error extracting addresses from PDF text:", error);
    return [];
  }
}

/**
 * Extract employment directly from PDF text
 */
async function extractEmploymentsFromText(pdfDocument: any): Promise<EmploymentInfo[]> {
  try {
    const employments: EmploymentInfo[] = [];
    
    // Look through first 10 pages for employment tables
    for (let i = 1; i <= Math.min(10, pdfDocument.numPages); i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      
      // Look for employment section indicators
      if ((pageText.includes("Employment") || pageText.includes("Employer")) && 
          (pageText.includes("Company") || pageText.includes("Occupation"))) {
        
        console.log(`Found employment section text on page ${i}`);
        
        // Get text items with their positions for better parsing
        const items = textContent.items;
        
        // Group items into rows based on vertical position
        const rows: any[][] = [];
        let currentRow: any[] = [];
        let lastY = -1;
        
        items.forEach((item: any) => {
          // Detect new row based on Y position change
          if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
            if (currentRow.length > 0) {
              rows.push([...currentRow]);
              currentRow = [];
            }
          }
          
          currentRow.push(item);
          lastY = item.transform[5];
        });
        
        // Add the last row if not empty
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        
        // Process rows into employments
        let foundEmploymentHeader = false;
        let companyCol = -1, occupationCol = -1;
        
        for (let r = 0; r < rows.length; r++) {
          const rowText = rows[r].map((item: any) => item.str).join(" ");
          
          // Find header row to identify columns
          if (!foundEmploymentHeader && 
              (rowText.includes("Company") || rowText.includes("Employer")) && 
              rowText.includes("Occupation")) {
            
            foundEmploymentHeader = true;
            
            // Find column positions
            rows[r].forEach((item: any, idx: number) => {
              const text = item.str.toLowerCase();
              if (text.includes("company") || text.includes("employer")) {
                companyCol = item.transform[4]; // X position
              }
              else if (text.includes("occupation")) {
                occupationCol = item.transform[4]; // X position
              }
            });
            
            continue; // Skip header row
          }
          
          // Process data rows
          if (foundEmploymentHeader) {
            // Sort row items by X position
            const sortedItems = [...rows[r]].sort((a, b) => a.transform[4] - b.transform[4]);
            
            // Assign items to columns
            let company = "", occupation = "";
            
            sortedItems.forEach((item: any) => {
              const x = item.transform[4];
              
              // Determine which column this item belongs to
              if (companyCol >= 0 && Math.abs(x - companyCol) < 100) {
                company += item.str + " ";
              }
              else if (occupationCol >= 0 && Math.abs(x - occupationCol) < 100) {
                occupation += item.str + " ";
              }
              // If columns aren't identified well, use position to guess
              else if (x < 350) {
                company += item.str + " ";
              }
              else {
                occupation += item.str + " ";
              }
            });
            
            // Clean up extracted values
            company = company.trim();
            occupation = occupation.trim();
            
            // Add to employments if there's actual content
            if (company && company !== "Company" && company !== "Employer") {
              employments.push({
                company,
                occupation
              });
            }
          }
        }
        
        // If we found employments, we can stop looking through pages
        if (employments.length > 0) {
          break;
        }
      }
    }
    
    return employments;
  } catch (error) {
    console.error("Error extracting employments from PDF text:", error);
    return [];
  }
}
