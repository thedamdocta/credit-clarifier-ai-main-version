
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for extracting images from PDFs
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
    return (window as any).currentPdf || null;
  };
  
  // Function to extract images
  const extractPdfImages = async (maxPages: number = 5) => {
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
      
      // Only show toast for larger docs
      if (numPages > 2) {
        toast.info(`Processing ${numPages} pages...`, { duration: 2000 });
      }
      
      for (let i = 0; i < numPages; i++) {
        const pageNum = i + 1; // Pages start at 1
        try {
          const image = await convertPDFPageToImage(pdf, pageNum);
          if (image) images.push(image);
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between pages
        } catch (err) {
          console.error(`Error converting page ${pageNum}:`, err);
        }
      }
      
      setPageImages(images);
      
      if (images.length === 0) {
        toast.warning("Could not extract any page images from the PDF.");
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
    
    // Calculate viewport
    const viewport = page.getViewport({ scale: 2.0 });
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    
    if (!context) {
      console.error("Could not create canvas context");
      return null;
    }
    
    // Set canvas dimensions
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Set white background for better contrast
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
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // Clean up
    page.cleanup && page.cleanup();
    
    return imageData;
  } catch (error) {
    console.error(`Error converting page ${pageNum} to image:`, error);
    return null;
  }
}
