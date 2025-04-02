
import { toast } from "sonner";

export interface ProgressCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
  updateProgress?: (value: number) => void; // Add updateProgress as an optional property
}

export const setupProgressTracking = (callbacks: ProgressCallbacks) => {
  const { setUploadProgress } = callbacks;
  let progressInterval: NodeJS.Timeout | null = null;
  
  // Function to update progress directly
  const updateProgress = (value: number) => {
    // Ensure value is within proper bounds
    const safeValue = Math.max(0, Math.min(value, 100));
    setUploadProgress(safeValue);
  };
  
  // Start progress interval for better UX - with less frequent updates to reduce UI load
  progressInterval = setInterval(() => {
    setUploadProgress((prev) => {
      // Only increment if not already complete and less aggressively
      if (prev >= 90) return prev;
      
      // Slow down as we approach higher percentages to avoid false completion
      let increment;
      if (prev < 30) increment = 0.7;
      else if (prev < 50) increment = 0.5;
      else if (prev < 70) increment = 0.3;
      else increment = 0.1;
      
      const newProgress = prev + increment;
      return newProgress > 90 ? 90 : newProgress;
    });
  }, 600); // Less frequent updates (600ms instead of 400ms)
  
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
    }, 2000); // Give more time to see completion
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
