
import { useState } from 'react';
import { convertPDFPageToImage } from '@/utils/pdf/pdfToImage';
import { toast } from 'sonner';

export function usePdfImageExtraction() {
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
  
  // Function to extract images efficiently
  const extractPdfImages = async (maxPages: number = 5) => {
    const pdf = getCurrentPdf();
    
    if (!pdf) {
      toast.error("No PDF found. Please upload a PDF first.");
      return [];
    }
    
    try {
      setIsProcessing(true);
      setError(null);
      
      const images: string[] = [];
      const numPages = Math.min(pdf.numPages, maxPages);
      
      // Process all pages sequentially
      for (let i = 1; i <= numPages; i++) {
        try {
          const imageData = await convertPDFPageToImage(pdf, i, false);
          if (imageData) {
            images.push(imageData);
          }
        } catch (pageError) {
          console.error(`Error extracting page ${i}:`, pageError);
        }
        
        // Add small delay between pages to prevent freezing
        await new Promise(resolve => setTimeout(resolve, 50));
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
