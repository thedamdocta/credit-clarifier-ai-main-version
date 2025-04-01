
import { toast } from "sonner";
import { extractTextFromImageWithOCR, processImageWithEnhancedOCR } from "@/lib/ai/ocrExtraction";
import { CreditReport } from "@/lib/types/creditReport";

export const extractTextFromPDF = async (pdf: any): Promise<string> => {
  let extractedText = '';
  
  // Extract text from all pages
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    extractedText += pageText + ' ';
    
    // Log progress for debugging
    console.log(`Processed page ${i} of ${pdf.numPages}`);
  }
  
  console.log('Text extraction complete. Text length:', extractedText.length);
  console.log('Sample text:', extractedText.substring(0, 300) + '...');
  
  return extractedText;
};

// Global storage for tracking the current PDF file
let currentPDFData: {
  imageUrl: string | null;
  timestamp: number;
  uploadedFile: File | null;
  reportId: string | null;
  extractedData: any | null; // Store extracted data to prevent overwriting with sample data
  imageElements: HTMLImageElement[]; // Store references to detected image elements
} = {
  imageUrl: null,
  timestamp: 0,
  uploadedFile: null,
  reportId: null,
  extractedData: null,
  imageElements: []
};

// Store the most recent uploaded file data
export const setCurrentPDFData = (file: File) => {
  console.log('Setting current PDF file:', file.name);
  
  // Generate a truly unique ID that includes file name and timestamp
  const uniqueId = `report-${Date.now()}-${file.name.replace(/\W/g, '')}`;
  
  currentPDFData = {
    imageUrl: null, // Will be set when image is extracted
    timestamp: Date.now(),
    uploadedFile: file,
    reportId: uniqueId,
    extractedData: null, // Reset extracted data for new file
    imageElements: [] // Reset image elements for new file
  };
  
  console.log('Updated current PDF data with new reportId:', uniqueId);
  return currentPDFData.reportId;
};

// Set extracted data when it's actually obtained from a real file
export const setExtractedReportData = (data: any) => {
  if (data && currentPDFData) {
    console.log('Storing actual extracted data for report:', currentPDFData.reportId);
    currentPDFData.extractedData = data;
    return true;
  }
  return false;
};

// Get extracted data if we have it
export const getExtractedReportData = () => {
  return currentPDFData?.extractedData || null;
};

// Reset the current image URL when processing a new report
export const resetCurrentReportImage = () => {
  console.log('Resetting current report image URL to null');
  if (currentPDFData) {
    currentPDFData.imageUrl = null;
    currentPDFData.timestamp = Date.now(); // Update timestamp to indicate a fresh reset
    currentPDFData.imageElements = []; // Clear any tracked images
  }
};

// Function to check if an image is related to a credit report or data table
const isRelevantImage = (imgSrc: string | null) => {
  if (!imgSrc) return false;
  
  // Check for common identifiers in the image URL
  const relevantPatterns = [
    'lovable-uploads',
    'credit',
    'report',
    'table',
    'equifax',
    'experian',
    'transunion',
    'accounts'
  ];
  
  return relevantPatterns.some(pattern => imgSrc.toLowerCase().includes(pattern.toLowerCase()));
};

// Scan the DOM for uploaded images and store them in the currentPDFData
const scanForUploadedImages = () => {
  const allImages = document.querySelectorAll('img');
  const relevantImages: HTMLImageElement[] = [];
  
  console.log(`Scanning DOM for images, found ${allImages.length} total images`);
  
  allImages.forEach((img: HTMLImageElement) => {
    const src = img.getAttribute('src');
    if (src && isRelevantImage(src)) {
      relevantImages.push(img);
      console.log('Found relevant image:', src);
    }
  });
  
  if (relevantImages.length > 0) {
    // Store all relevant images in currentPDFData
    currentPDFData.imageElements = relevantImages;
    
    // Set the most recent one as the current image URL
    const mostRecentImage = relevantImages[relevantImages.length - 1];
    const imgSrc = mostRecentImage.getAttribute('src');
    
    if (imgSrc) {
      currentPDFData.imageUrl = imgSrc;
      console.log('Set current PDF data image URL to:', imgSrc);
      return true;
    }
  }
  
  return false;
};

// Extract credit account table as image for two-stage processing
export const extractCreditAccountsTableImage = async (report: CreditReport | null): Promise<string | null> => {
  try {
    console.log('Finding image for report extraction, report ID:', report?.reportId);
    console.log('Current cache state: ', currentPDFData);
    
    // First attempt: Scan the DOM for all relevant images (this is more reliable)
    const imagesFound = scanForUploadedImages();
    
    // If we found relevant images, use the cached image URL
    if (imagesFound && currentPDFData.imageUrl) {
      // Add cache-busting timestamp
      const cacheBustedUrl = currentPDFData.imageUrl.includes('?') ? 
        `${currentPDFData.imageUrl}&t=${Date.now()}` : 
        `${currentPDFData.imageUrl}?t=${Date.now()}`;
      
      console.log('Using scanned image from DOM:', cacheBustedUrl);
      return cacheBustedUrl;
    }
    
    // Second attempt: Look specifically for uploaded images with lovable-uploads in the path
    const uploadedImagesSelector = 'img[src*="lovable-uploads/"], img[src*="/lovable-uploads/"]';
    const uploadedImages = document.querySelectorAll(uploadedImagesSelector);
    console.log(`Found ${uploadedImages.length} uploaded images in the DOM using broader selector: ${uploadedImagesSelector}`);
    
    if (uploadedImages.length > 0) {
      // Get the most recent image (last one in the DOM)
      const mostRecentImage = uploadedImages[uploadedImages.length - 1] as HTMLImageElement;
      const imgSrc = mostRecentImage.getAttribute('src');
      
      if (imgSrc) {
        console.log('Found uploaded image:', imgSrc);
        
        // Update the cache with this URL
        currentPDFData.imageUrl = imgSrc;
        
        // Add cache-busting timestamp
        const cacheBustedUrl = imgSrc.includes('?') ? 
          `${imgSrc}&t=${Date.now()}` : 
          `${imgSrc}?t=${Date.now()}`;
          
        console.log('Using actual uploaded image:', cacheBustedUrl);
        return cacheBustedUrl;
      }
    }
    
    // Third attempt: Check for global reference to current PDF
    if (window.currentPdfData && window.currentPdfData.reportId) {
      console.log('Found global PDF data reference:', window.currentPdfData);
      
      // Check again for images after a short delay (in case they're still loading)
      await new Promise(resolve => setTimeout(resolve, 200));
      const secondScanResult = scanForUploadedImages();
      
      if (secondScanResult && currentPDFData.imageUrl) {
        const cacheBustedUrl = currentPDFData.imageUrl.includes('?') ? 
          `${currentPDFData.imageUrl}&t=${Date.now()}` : 
          `${currentPDFData.imageUrl}?t=${Date.now()}`;
        
        console.log('Found image on second scan:', cacheBustedUrl);
        return cacheBustedUrl;
      }
    }
    
    // Check for the image directly in the report object if available
    if (report && report.reportId && report.fileName) {
      // Look for images in different containers that might host the uploaded images
      const containers = [
        document.querySelector('.pdf-preview'),
        document.querySelector('.report-preview'),
        document.querySelector('.image-preview'),
        document.body
      ];
      
      for (const container of containers) {
        if (container) {
          const images = container.querySelectorAll('img');
          if (images.length > 0) {
            console.log(`Found ${images.length} images in container`);
            const lastImage = images[images.length - 1] as HTMLImageElement;
            const imgSrc = lastImage.getAttribute('src');
            
            if (imgSrc && isRelevantImage(imgSrc)) {
              currentPDFData.imageUrl = imgSrc;
              const cacheBustedUrl = imgSrc.includes('?') ? 
                `${imgSrc}&t=${Date.now()}` : 
                `${imgSrc}?t=${Date.now()}`;
              
              console.log('Found image in container:', cacheBustedUrl);
              return cacheBustedUrl;
            }
          }
        }
      }
    }
    
    // If we have a cached image URL from a previous extraction
    if (currentPDFData.imageUrl) {
      console.log('Using cached image URL with timestamp:', currentPDFData.timestamp);
      
      // Add a cache-busting timestamp to ensure we get a fresh image
      const cachedUrl = currentPDFData.imageUrl;
      const cacheBustedUrl = cachedUrl.includes('?') ? 
        `${cachedUrl}&t=${Date.now()}` : 
        `${cachedUrl}?t=${Date.now()}`;
        
      return cacheBustedUrl;
    }
    
    // Fallback to using test images if available
    const testImages = [
      "/lovable-uploads/3f5da6bd-b94e-4b22-91f1-cfe0d84e2f12.png",
      "/lovable-uploads/a0a9c72b-ad0d-4dce-9e0e-46dccfbb2bb0.png",
      "/lovable-uploads/1488cf26-6a12-4b97-b614-866ade912179.png",
      "/lovable-uploads/2627ca8b-c596-46f7-b81e-49ceea65c3bc.png" // Add the new image
    ];
    
    // Check if any of these test images exist in the DOM
    for (const testImage of testImages) {
      const testCheck = document.querySelector(`img[src="${testImage}"], img[src^="${testImage}"]`);
      if (testCheck) {
        console.log('Found test image in the DOM:', testImage);
        currentPDFData.imageUrl = testImage;
        return `${testImage}?t=${Date.now()}`;
      }
    }
    
    console.log('No suitable image found for extraction, enabling simulation mode');
    return null;
  } catch (error) {
    console.error('Error finding image for extraction:', error);
    return null;
  }
};
