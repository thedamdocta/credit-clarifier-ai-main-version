
import { toast } from "sonner";

export interface ProgressCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
}

export const setupProgressTracking = (callbacks: ProgressCallbacks) => {
  const { setUploadProgress } = callbacks;
  
  // Start progress interval for better UX
  const progressInterval = setInterval(() => {
    setUploadProgress((prev) => {
      const newProgress = prev + 5;
      return newProgress > 90 ? 90 : newProgress;
    });
  }, 100);
  
  // Function to clear the progress interval
  const clearProgressTracking = () => {
    clearInterval(progressInterval);
  };
  
  // Function to complete progress tracking
  const completeProgressTracking = () => {
    clearProgressTracking();
    setUploadProgress(100);
    
    // Reset progress after a delay
    setTimeout(() => {
      setUploadProgress(0);
    }, 1000);
  };
  
  // Function to handle errors in progress tracking
  const handleProgressError = (error: any) => {
    console.error("Error in PDF processing:", error);
    toast.error("An error occurred while processing the PDF.");
    clearProgressTracking();
    setUploadProgress(0);
  };
  
  return {
    clearProgressTracking,
    completeProgressTracking,
    handleProgressError
  };
};

