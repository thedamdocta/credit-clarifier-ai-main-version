
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { processPDFDocument } from "@/utils/pdf";

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
  const [modelsLoaded, setModelsLoaded] = useState(true); // Always set to true to avoid loading
  const [modelLoadRetries, setModelLoadRetries] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Maximum file size to process without warning (in MB)
  const MAX_RECOMMENDED_FILE_SIZE = 50;

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
          await processPDFDocument(file, false, {  // Always set useAI to false
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
