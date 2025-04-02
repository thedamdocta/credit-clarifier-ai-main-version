
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for extracting images from PDFs with optimized performance
 */
export function usePdfExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Get the current image URL (or null if none available)
  const currentImageUrl = pageImages.length > 0 && selectedPage < pageImages.length 
    ? pageImages[selectedPage] 
    : null;
  
  // Function to get PDF from global context
  const getCurrentPdf = () => {
    if (typeof window === 'undefined') return null;
    return window.currentPdf || null;
  };
  
  // Function to extract images efficiently
  const extractPdfImages = async (maxPages: number = 10) => {
    const pdf = getCurrentPdf();
    
    if (!pdf) {
      toast.error("No PDF found. Please upload a PDF first.");
      return;
    }
    
    try {
      setIsProcessing(true);
      setError(null);
      
      const images: string[] = [];
      const numPages = Math.min(pdf.numPages, maxPages);
      
      toast.info(`Processing ${numPages} pages from PDF...`);
      
      // Process pages in smaller batches to prevent UI freezing
      const batchSize = 3;
      
      for (let i = 0; i < numPages; i += batchSize) {
        const batch = [];
        
        for (let j = 0; j < batchSize && i + j < numPages; j++) {
          const pageNum = i + j + 1; // Pages start at 1
          batch.push(convertPDFPageToImage(pdf, pageNum));
        }
        
        // Process each batch concurrently
        const batchResults = await Promise.allSettled(batch);
        
        // Add successful results to our images array
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            images.push(result.value);
          }
        });
        
        // Yield to UI thread before processing next batch
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      setPageImages(images);
      
      if (images.length === 0) {
        toast.warning("Could not extract any page images from the PDF.");
      } else {
        toast.success(`Extracted ${images.length} pages from PDF`);
      }
      
      return images;
    } catch (error) {
      console.error("Error extracting PDF images:", error);
      setError("Failed to extract images from PDF");
      toast.error("Failed to process PDF pages");
      return [];
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    isProcessing,
    pageImages,
    selectedPage,
    setSelectedPage,
    error,
    extractPdfImages,
    currentImageUrl,
  };
}

/**
 * Convert a single PDF page to an image
 */
async function convertPDFPageToImage(pdf: any, pageNum: number): Promise<string | null> {
  try {
    // Get the page
    const page = await pdf.getPage(pageNum);
    
    // Calculate viewport with higher resolution for better OCR
    const viewport = page.getViewport({ scale: 2.5 });
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    
    if (!context) {
      console.error("Could not create canvas context");
      return null;
    }
    
    // Set canvas dimensions
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Set white background for better OCR contrast
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render the page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      background: 'white'
    };
    
    await page.render(renderContext).promise;
    
    // Convert canvas to data URL
    const imageData = canvas.toDataURL('image/png');
    
    // Clean up to save memory
    page.cleanup && page.cleanup();
    
    return imageData;
  } catch (error) {
    console.error(`Error converting page ${pageNum} to image:`, error);
    return null;
  }
}
