
import { useState } from 'react';
import { toast } from 'sonner';

export const useSimplePdfExtraction = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Get the current image URL based on selected page
  const currentImageUrl = pageImages.length > 0 && selectedPage < pageImages.length
    ? pageImages[selectedPage]
    : null;
  
  // Reset state
  const resetState = () => {
    setPageImages([]);
    setSelectedPage(0);
    setError(null);
  };
  
  // Simulate PDF extraction without AI
  const extractPdfImages = async () => {
    try {
      setIsProcessing(true);
      resetState();
      
      // Simulate loading time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, create mock PDF page images
      const mockPages = [
        'https://via.placeholder.com/800x1000/f4f4f4/333333?text=Sample+Account+Page+1',
        'https://via.placeholder.com/800x1000/f4f4f4/333333?text=Sample+Account+Page+2',
        'https://via.placeholder.com/800x1000/f4f4f4/333333?text=Sample+Account+Page+3',
      ];
      
      setPageImages(mockPages);
      setSelectedPage(0);
      
      toast.success('PDF pages extracted successfully');
    } catch (error) {
      console.error('Error extracting PDF:', error);
      setError('Failed to extract PDF pages. Please try again.');
      toast.error('Failed to extract PDF pages');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    isProcessing,
    pageImages,
    selectedPage,
    setSelectedPage,
    currentImageUrl,
    extractPdfImages,
    error
  };
};
