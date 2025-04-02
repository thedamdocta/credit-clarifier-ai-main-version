
import { toast } from "sonner";

export interface ProgressCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
}

export const setupProgressTracking = (callbacks: ProgressCallbacks) => {
  const { setUploadProgress } = callbacks;
  let progressInterval: NodeJS.Timeout | null = null;
  
  // Function to update progress directly
  const updateProgress = (value: number) => {
    setUploadProgress(value);
  };
  
  // Start progress interval for better UX - with less frequent updates to reduce UI load
  progressInterval = setInterval(() => {
    setUploadProgress((prev) => {
      // Only increment if not already complete and less aggressively
      if (prev >= 95) return prev;
      const increment = prev < 50 ? 2 : 1; // Slower increments as we progress
      const newProgress = prev + increment;
      return newProgress > 95 ? 95 : newProgress;
    });
  }, 400); // Less frequent updates (400ms instead of 100ms)
  
  // Function to clear the progress interval
  const clearProgressTracking = () => {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  };
  
  // Function to complete progress tracking
  const completeProgressTracking = () => {
    clearProgressTracking();
    setUploadProgress(100);
    
    // Reset progress after a delay
    setTimeout(() => {
      setUploadProgress(0);
    }, 1500); // Give more time to see completion
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
