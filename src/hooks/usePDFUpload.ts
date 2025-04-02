
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { processPDFDocument } from "@/utils/pdf";
import { loadedModels, isModelLoading, getModelLoadingDuration } from "@/lib/ai/modelPipelines";

interface UsePDFUploadProps {
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  useAI: boolean;
  useImageExtraction?: boolean;
}

export const usePDFUpload = ({ onPDFUploaded, useAI, useImageExtraction = true }: UsePDFUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadRetries, setModelLoadRetries] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Maximum file size to process without warning (in MB)
  const MAX_RECOMMENDED_FILE_SIZE = 50;

  // Check if models are preloaded at initialization with improved retry logic
  useEffect(() => {
    // Check if models are already loaded
    if (typeof loadedModels === 'object') {
      const anyModelLoaded = loadedModels.ner || loadedModels.classifier;
      setModelsLoaded(anyModelLoaded);
      
      if (anyModelLoaded) {
        console.log("AI models already loaded, ready for processing");
      }
    }
    
    // Set up a periodic check for loaded models with limited retries
    const checkInterval = setInterval(() => {
      if (typeof loadedModels === 'object' && (loadedModels.ner || loadedModels.classifier)) {
        setModelsLoaded(true);
        clearInterval(checkInterval);
      } else {
        // Increment retry counter
        setModelLoadRetries(prev => {
          const newCount = prev + 1;
          // After 60 seconds (30 checks at 2s interval), stop checking
          if (newCount > 30) {
            console.log("Giving up on model loading checks after 60s");
            clearInterval(checkInterval);
          }
          return newCount;
        });
      }
    }, 2000); // Check every 2 seconds instead of 1s to reduce overhead
    
    return () => clearInterval(checkInterval);
  }, []);

  const processPDF = async (file: File) => {
    try {
      // Check file size before proceeding
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > MAX_RECOMMENDED_FILE_SIZE) {
        toast.warning(
          `This file is ${Math.round(fileSizeMB)}MB, which may take longer to process. Please be patient.`,
          { duration: 6000 }
        );
      }
      
      setIsProcessing(true);
      
      // Show initial upload started toast
      toast.info(`Processing ${file.name}`, {
        duration: 3000,
      });
      
      // Use setTimeout to create a small delay before starting heavy processing
      // This gives the UI a chance to update with the loading indicators
      setTimeout(async () => {
        try {
          // Process the PDF file with enhanced image extraction
          await processPDFDocument(file, useAI, {
            setCurrentFile,
            setUploadProgress,
            onPDFUploaded,
            useImageExtraction
          });
        } catch (error) {
          console.error("PDF processing error:", error);
          toast.error("Failed to process the PDF. Please try a different file.");
          setIsProcessing(false);
        }
      }, 100);
    } catch (error) {
      console.error("PDF processing error:", error);
      toast.error("Failed to process the PDF. Please try a different file.");
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (isProcessing) {
      toast.warning("Already processing a file. Please wait.");
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        processPDF(file);
      } else {
        toast.error("Please upload a PDF file.");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) {
      toast.warning("Already processing a file. Please wait.");
      return;
    }
    
    if (e.target.files && e.target.files.length > 0) {
      processPDF(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (isProcessing) {
      toast.warning("Already processing a file. Please wait.");
      return;
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return {
    isDragging,
    uploadProgress,
    currentFile,
    isProcessing,
    modelsLoaded,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    triggerFileInput
  };
};
