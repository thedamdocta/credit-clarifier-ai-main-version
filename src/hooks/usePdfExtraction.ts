
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for extracting images from PDFs with optimized performance
 * Uses compression and smaller batches for better speed
 */
export function usePdfExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  
  // Get the current image URL (or null if none available)
  const currentImageUrl = pageImages.length > 0 && selectedPage < pageImages.length 
    ? pageImages[selectedPage] 
    : null;
  
  // Function to get PDF from global context
  const getCurrentPdf = () => {
    if (typeof window === 'undefined') return null;
    return (window as any).currentPdf || null;
  };
  
  // Function to extract images efficiently with batching and compression
  const extractPdfImages = async (maxPages: number = 5) => { // Reduced maxPages from 10 to 5
    const pdf = getCurrentPdf();
    
    if (!pdf) {
      toast.error("No PDF found. Please upload a PDF first.");
      return;
    }
    
    try {
      setIsProcessing(true);
      setError(null);
      setProcessingStartTime(Date.now());
      
      const images: string[] = [];
      const numPages = Math.min(pdf.numPages, maxPages);
      
      // Only show toast for larger docs
      if (numPages > 2) {
        toast.info(`Processing ${numPages} pages...`, { duration: 2000 });
      }
      
      // Process pages in smaller batches to prevent UI freezing
      // Reduced batch size from 3 to 2
      const batchSize = 2;
      
      for (let i = 0; i < numPages; i += batchSize) {
        // Show periodic updates for long-running processes
        if (processingStartTime && (Date.now() - processingStartTime > 3000) && i > 0) {
          toast.info(`Still processing pages... (${i}/${numPages})`, { duration: 2000, id: "pdf-progress" });
        }
        
        const batch = [];
        
        for (let j = 0; j < batchSize && i + j < numPages; j++) {
          const pageNum = i + j + 1; // Pages start at 1
          batch.push(convertPDFPageToImage(pdf, pageNum, true)); // Added compression flag
        }
        
        // Process each batch concurrently
        const batchResults = await Promise.allSettled(batch);
        
        // Add successful results to our images array
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            images.push(result.value);
          }
        });
        
        // Yield to UI thread before processing next batch - increased from 50ms to 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setPageImages(images);
      
      if (images.length === 0) {
        toast.warning("Could not extract any page images from the PDF.");
      } else if (images.length < numPages) {
        toast.success(`Extracted ${images.length} pages (some pages were skipped)`);
      } else {
        toast.success(`Extracted ${images.length} pages`);
      }
      
      return images;
    } catch (error) {
      console.error("Error extracting PDF images:", error);
      setError("Failed to extract images from PDF");
      toast.error("Failed to process PDF pages");
      return [];
    } finally {
      setIsProcessing(false);
      setProcessingStartTime(null);
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
 * Optimized with compression for better performance
 */
async function convertPDFPageToImage(pdf: any, pageNum: number, useCompression: boolean = true): Promise<string | null> {
  try {
    // Get the page
    const page = await pdf.getPage(pageNum);
    
    // Calculate viewport with slightly lower resolution for better performance
    // Reduced scale from 2.5 to 2.0 for faster processing
    const scale = useCompression ? 2.0 : 2.5;
    const viewport = page.getViewport({ scale });
    
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
    
    // Convert canvas to data URL with compression for better performance
    // Reduced quality from 1.0 to 0.8 for JPEG or 0.6 if high compression requested
    const imageQuality = useCompression ? 0.6 : 0.8;
    const imageFormat = useCompression ? 'image/jpeg' : 'image/png';
    const imageData = canvas.toDataURL(imageFormat, imageQuality);
    
    // Clean up to save memory
    page.cleanup && page.cleanup();
    
    return imageData;
  } catch (error) {
    console.error(`Error converting page ${pageNum} to image:`, error);
    return null;
  }
}
