import { useState, useRef } from "react";
import { toast } from "sonner";
import { processPDFDocument } from "@/utils/pdf";

interface UsePDFUploadProps {
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  useAI: boolean;
  onError?: (error: Error | null) => void;
  onProcessingStart?: () => void;
  onProcessingComplete?: () => void;
}

export const usePDFUpload = ({ 
  onPDFUploaded, 
  useAI, 
  onError, 
  onProcessingStart, 
  onProcessingComplete 
}: UsePDFUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processPDF = (file: File) => {
    // Reset any previous errors
    setProcessingError(null);
    
    // Notify that processing has started
    if (onProcessingStart) {
      onProcessingStart();
    }
    
    // Process the PDF file with focus on text extraction for the main content
    // and enable improved table detection specifically for the credit accounts table
    try {
      processPDFDocument(file, useAI, {
        setCurrentFile,
        setUploadProgress,
        onPDFUploaded: (file, text, parsedReport) => {
          onPDFUploaded(file, text, parsedReport);
          // Processing is complete - call the callback
          if (onProcessingComplete) {
            onProcessingComplete();
          }
        },
        useImageExtraction: true, // Enable image extraction for table detection
        targetTable: "Credit Accounts", // Specifically target the Credit Accounts table
        onError: (error) => {
          console.error("PDF processing error:", error);
          const errorMessage = error?.message || "Failed to process the PDF file. Please try again.";
          setProcessingError(errorMessage);
          if (onError) onError(error);
          // On error, processing is also complete
          if (onProcessingComplete) {
            onProcessingComplete();
          }
        }
      });
    } catch (error) {
      const typedError = error as Error;
      console.error("Exception during PDF processing:", typedError);
      setProcessingError(typedError.message || "An unexpected error occurred");
      if (onError) onError(typedError);
      setUploadProgress(0);
      // On exception, processing is also complete
      if (onProcessingComplete) {
        onProcessingComplete();
      }
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
    if (e.target.files && e.target.files.length > 0) {
      processPDF(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return {
    isDragging,
    uploadProgress,
    currentFile,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    triggerFileInput,
    processingError
  };
};
