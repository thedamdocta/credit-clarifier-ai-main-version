
import { toast } from "sonner";

export interface ProgressCallbacks {
  setCurrentFile: (file: File) => void;
  setUploadProgress: (value: number | ((prev: number) => number)) => void;
  slowDownProgress?: boolean; // Option to slow down progress for longer processing
  onCompleteCallback?: () => void; // New callback for when processing is fully complete
}

export const setupProgressTracking = (callbacks: ProgressCallbacks) => {
  const { 
    setUploadProgress, 
    slowDownProgress = false,
    onCompleteCallback 
  } = callbacks;
  
  // Function to update progress directly
  const updateProgress = (value: number) => {
    setUploadProgress(value);
  };
  
  // Start progress interval for better UX - slower if requested
  const updateInterval = slowDownProgress ? 300 : 150; // Slower updates for longer processes
  const incrementAmount = slowDownProgress ? 0.5 : 2; // Even smaller increments for longer processes
  
  // Cap progress at different levels based on extraction stages
  // Stop at 85% for table extraction, 95% for general processing
  const stageCaps = {
    initialExtraction: 50, // Initial text extraction
    parsing: 70,           // Basic parsing
    tableExtraction: 85,   // Table extraction with OpenAI
    finalProcessing: 95    // Final processing and data preparation
  };
  
  // Start the progress interval
  const progressInterval = setInterval(() => {
    setUploadProgress((prev) => {
      // Determine which cap to use based on current progress
      let cap = stageCaps.initialExtraction;
      if (prev >= stageCaps.initialExtraction) cap = stageCaps.parsing;
      if (prev >= stageCaps.parsing) cap = stageCaps.tableExtraction;
      if (prev >= stageCaps.tableExtraction) cap = stageCaps.finalProcessing;
      
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
    
    // Animate to 100% with a slight delay to show completion
    setTimeout(() => {
      setUploadProgress(100);
      
      // Only trigger onCompleteCallback after progress reaches 100%
      if (onCompleteCallback) {
        // Delay navigation slightly to show 100% progress state
        setTimeout(onCompleteCallback, 800);
      }
    }, 200);
  };
  
  // Function to handle errors in progress tracking
  const handleProgressError = (error: any) => {
    console.error("Error in PDF processing:", error);
    toast.error("An error occurred while processing the PDF.");
    clearProgressTracking();
    setUploadProgress(0);
  };
  
  // Function to update progress to a specific stage
  const updateProgressStage = (stage: keyof typeof stageCaps) => {
    setUploadProgress(stageCaps[stage]);
  };
  
  return {
    updateProgress,
    updateProgressStage,
    clearProgressTracking,
    completeProgressTracking,
    handleProgressError
  };
};
