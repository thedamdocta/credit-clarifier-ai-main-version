
import { useState } from 'react';
import { toast } from 'sonner';

export const useSimplePdfExtraction = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // Get the current image URL based on selected page
  const currentImageUrl = pageImages.length > 0 && selectedPage < pageImages.length
    ? pageImages[selectedPage]
    : null;
  
  // Reset state
  const resetState = () => {
    setPageImages([]);
    setSelectedPage(0);
    setError(null);
    setProcessingProgress(0);
  };
  
  // Simulate PDF extraction without AI - completely non-AI version
  const extractPdfImages = async () => {
    try {
      setIsProcessing(true);
      resetState();
      
      // Simulate progress updates (purely visual, no actual AI processing)
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return newProgress;
        });
      }, 200);
      
      // Use realistic mock PDF page images
      const mockPages = [
        '/lovable-uploads/b5825a77-a40f-4990-bfc7-23f74a16cd1f.png', // Use the uploaded image as first mock page
        'https://via.placeholder.com/800x1000/f8f9fa/333333?text=Sample+Account+Page+2',
        'https://via.placeholder.com/800x1000/f8f9fa/333333?text=Sample+Account+Page+3',
      ];
      
      // Add a small delay to simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPageImages(mockPages);
      setSelectedPage(0);
      clearInterval(progressInterval);
      setProcessingProgress(100);
      
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
    error,
    processingProgress
  };
};
