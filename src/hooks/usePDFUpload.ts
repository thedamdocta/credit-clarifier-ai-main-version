import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { processPDFDocument } from "@/utils/pdf";
import { loadedModels } from "@/lib/ai/modelPipelines";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if models are preloaded at initialization
  useEffect(() => {
    // Check if models are already loaded
    if (typeof loadedModels === 'object') {
      const anyModelLoaded = loadedModels.ner || loadedModels.classifier;
      setModelsLoaded(anyModelLoaded);
      
      if (anyModelLoaded) {
        console.log("AI models already loaded, ready for processing");
      }
    }
    
    // Set up a periodic check for loaded models
    const checkInterval = setInterval(() => {
      if (typeof loadedModels === 'object' && (loadedModels.ner || loadedModels.classifier)) {
        setModelsLoaded(true);
        clearInterval(checkInterval);
      }
    }, 1000);
    
    return () => clearInterval(checkInterval);
  }, []);

  const processPDF = async (file: File) => {
    try {
      setIsProcessing(true);
      
      // Show initial upload started toast
      toast.info(`Processing ${file.name}`, {
        duration: 3000,
      });
      
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
    } finally {
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
