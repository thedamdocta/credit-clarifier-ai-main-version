
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
    
    // First try to find the addresses table (usually on first few pages)
    let addressesImage: string | null = null;
    let employmentImage: string | null = null;
    
    // Keywords to identify contact info section
    const contactKeywords = [
      'contact information',
      'address',
      'addresses',
      'current address',
      'former address', 
      'employment',
      'employer'
    ];
    
    // Check first few pages for contact info tables
    for (let i = 1; i <= Math.min(5, numPages); i++) {
      try {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ").toLowerCase();
        
        // Look for address section keywords
        if (!addressesImage && 
            (pageText.includes("address") || 
             pageText.includes("addresses") || 
             pageText.includes("contact information"))) {
          
          console.log(`Found possible address section on page ${i}`);
          // Try to extract top half of the page where addresses usually are
          const addressRegion = { x: 50, y: 150, width: 500, height: 250 };
          addressesImage = await extractRegionFromPDFPage(pdfDocument, i, addressRegion);
          
          if (addressesImage) {
            console.log("Successfully extracted address image");
            addContactTableImage(addressesImage);
          }
        }
        
        // Look for employment section keywords
        if (!employmentImage && 
            (pageText.includes("employment") || 
             pageText.includes("employer") || 
             pageText.includes("occupation"))) {
          
          console.log(`Found possible employment section on page ${i}`);
          // Try to extract bottom half of the page where employment usually is
          const employmentRegion = { x: 50, y: 350, width: 500, height: 150 };
          employmentImage = await extractRegionFromPDFPage(pdfDocument, i, employmentRegion);
          
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
    
    // If still empty, try to extract from text using regex
    if (result.addresses.length === 0 || result.employments.length === 0) {
      // Fallback to text extraction would go here
      console.log("Image extraction provided insufficient data, falling back to text extraction");
      
      // For development/testing, create sample data
      if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
        if (result.addresses.length === 0) {
          result.addresses = createSampleAddresses();
        }
        if (result.employments.length === 0) {
          result.employments = createSampleEmployment();
        }
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
    
    // The prompt formatting is similar to the Account Summaries extraction
    const extractedData = await extractTableWithOpenAI(imageUrl);
    
    // Fix: Convert the generic response to AddressInfo format correctly
    if (extractedData && Array.isArray(extractedData)) {
      return extractedData
        .filter(item => item && typeof item === 'object')
        .map(item => {
          // Use type assertion to access dynamic properties safely
          const dataItem = item as Record<string, any>;
          return {
            address: String(dataItem.address || dataItem.value || dataItem.text || 'Unknown'),
            status: String(dataItem.status || dataItem.type || 'Unknown'),
            dateReported: String(dataItem.dateReported || dataItem.date || '')
          };
        });
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
    
    // The prompt formatting is similar to the Account Summaries extraction
    const extractedData = await extractTableWithOpenAI(imageUrl);
    
    // Fix: Convert the generic response to EmploymentInfo format correctly
    if (extractedData && Array.isArray(extractedData)) {
      return extractedData
        .filter(item => item && typeof item === 'object')
        .map(item => {
          // Use type assertion to access dynamic properties safely
          const dataItem = item as Record<string, any>;
          return {
            company: String(dataItem.company || dataItem.employer || dataItem.name || dataItem.value || 'Unknown'),
            occupation: String(dataItem.occupation || dataItem.position || dataItem.title || dataItem.job || '')
          };
        });
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
      const address = match[2]?.trim() || "Unknown";
      const dateReported = match[3]?.trim() || "";
      
      addresses.push({
        status,
        address,
        dateReported
      });
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
          
          addresses.push({
            status,
            address,
            dateReported
          });
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
    const employmentRegex = /(?:employer|employment)\s*:?\s*([^-\n]+)(?:\s*-\s*([^\n]+))?/gi;
    
    let match;
    while ((match = employmentRegex.exec(text)) !== null) {
      const company = match[1]?.trim() || "Unknown";
      const occupation = match[2]?.trim() || "";
      
      employments.push({
        company,
        occupation
      });
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
            const company = parts[0].replace(/employer|employment|company/i, '').trim() || "Unknown";
            const occupation = parts.length > 1 ? parts[1].trim() : "";
            
            employments.push({
              company,
              occupation
            });
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
 * Create sample addresses for development testing
 */
function createSampleAddresses(): AddressInfo[] {
  return [
    {
      address: "123 Main Street, Anytown, CA 12345",
      status: "Current",
      dateReported: "Dec 27, 2024"
    },
    {
      address: "456 Oak Avenue, Old City, CA 54321",
      status: "Former",
      dateReported: "Jan 15, 2022"
    },
    {
      address: "789 Pine Boulevard, Somewhere, CA 67890",
      status: "Former",
      dateReported: "Mar 3, 2018"
    }
  ];
}

/**
 * Create sample employment for development testing
 */
function createSampleEmployment(): EmploymentInfo[] {
  return [
    {
      company: "SUNSTATE SECURITY",
      occupation: "SECURITY OFFICER"
    },
    {
      company: "PREVIOUS COMPANY INC",
      occupation: "SALES ASSOCIATE"
    }
  ];
}

