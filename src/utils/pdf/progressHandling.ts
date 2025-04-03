
import { toast } from "sonner";

export interface ProgressCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
  slowDownProgress?: boolean; // New option to slow down progress for longer processing
}

export const setupProgressTracking = (callbacks: ProgressCallbacks) => {
  const { setUploadProgress, slowDownProgress = false } = callbacks;
  
  // Function to update progress directly
  const updateProgress = (value: number) => {
    setUploadProgress(value);
  };
  
  // Start progress interval for better UX - slower if requested
  const updateInterval = slowDownProgress ? 250 : 100; // Slower updates for longer processes
  const incrementAmount = slowDownProgress ? 1 : 5; // Smaller increments for longer processes
  
  const progressInterval = setInterval(() => {
    setUploadProgress((prev) => {
      // Cap at different levels based on slowness
      const cap = slowDownProgress ? 95 : 90;
      const newProgress = prev + incrementAmount;
      return newProgress > cap ? cap : newProgress;
    });
  }, updateInterval);
  
  // Function to clear the progress interval
  const clearProgressTracking = () => {
    clearInterval(progressInterval);
  };
  
  // Function to complete progress tracking
  const completeProgressTracking = () => {
    clearProgressTracking();
    setUploadProgress(100);
    
    // Reset progress after a delay - longer if slow progress was used
    const resetDelay = slowDownProgress ? 2000 : 1000;
    setTimeout(() => {
      setUploadProgress(0);
    }, resetDelay);
  };
  
  // Function to handle errors in progress tracking
  const handleProgressError = (error: any) => {
    console.error("Error in PDF processing:", error);
    toast.error("An error occurred while processing the PDF.");
    clearProgressTracking();
    setUploadProgress(0);
  };
  
  return {
    updateProgress,
    clearProgressTracking,
    completeProgressTracking,
    handleProgressError
  };
};
