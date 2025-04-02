
import { useState, useEffect } from 'react';
import { convertPDFPageToImage } from '@/utils/pdf/pdfToImage';
import { toast } from 'sonner';
import { getExtractedReportData } from '@/utils/pdf/extractText';

export function usePdfImageExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Function to extract images from PDF
  const extractImagesFromPDF = async (pdf: any, maxPages: number = 5) => {
    if (!pdf) return [];
    
    try {
      setIsProcessing(true);
      setError(null);
      
      const totalPages = Math.min(pdf.numPages, maxPages);
      console.log(`Extracting ${totalPages} pages from PDF`);
      
      const images: string[] = [];
      
      for (let i = 1; i <= totalPages; i++) {
        try {
          const imageData = await convertPDFPageToImage(pdf, i);
          if (imageData) {
            images.push(imageData);
          }
        } catch (pageError) {
          console.error(`Error extracting page ${i}:`, pageError);
        }
        
        // Add small delay between pages to prevent freezing
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`Extracted ${images.length} page images`);
      return images;
    } catch (err) {
      console.error("Error extracting PDF images:", err);
      setError("Failed to extract images from PDF");
      return [];
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Function to get current PDF document
  const getCurrentPdf = () => {
    if (typeof window === 'undefined') return null;
    return window.currentPdf || null;
  };
  
  // Function to extract images from current PDF
  const extractCurrentPdfImages = async () => {
    const pdf = getCurrentPdf();
    
    if (!pdf) {
      toast.error("No PDF document available. Please upload a PDF first.");
      setError("No PDF document found");
      return [];
    }
    
    // Extract images and update state
    const images = await extractImagesFromPDF(pdf);
    setPageImages(images);
    setSelectedPage(0);
    
    return images;
  };
  
  // Function to get account table image
  const getAccountTableImage = () => {
    // First check if we already have cached page images
    if (pageImages.length > 0 && selectedPage < pageImages.length) {
      return pageImages[selectedPage];
    }
    
    // If no page images, check if we already have PDF page images cached
    if (typeof window !== 'undefined' && window.currentPdfPageImages && window.currentPdfPageImages.length > 0) {
      return window.currentPdfPageImages[0];
    }
    
    return null;
  };
  
  return {
    isProcessing,
    pageImages,
    selectedPage,
    setSelectedPage,
    error,
    extractCurrentPdfImages,
    getAccountTableImage
  };
}
