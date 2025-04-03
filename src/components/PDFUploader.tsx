
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePDFUpload } from "@/hooks/usePDFUpload";
import PDFUploadPlaceholder from "./PDFUploadPlaceholder";
import PDFProgressDisplay from "./PDFProgressDisplay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canUseOpenAI } from "@/lib/ai/openai/openaiService";

interface PDFUploaderProps {
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  onProcessingComplete: () => void;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ 
  onPDFUploaded, 
  isProcessing,
  setIsProcessing,
  onProcessingComplete
}) => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readyToNavigate, setReadyToNavigate] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string | undefined>(undefined);
  const [openAIConfigured, setOpenAIConfigured] = useState(canUseOpenAI());
  
  const {
    isDragging,
    uploadProgress,
    currentFile,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    triggerFileInput,
    processingError,
    processingComplete
  } = usePDFUpload({ 
    onPDFUploaded: (file, text, parsedReport) => {
      console.log("PDF processing completed, preparing data before navigation");
      onPDFUploaded(file, text, parsedReport);
      setReadyToNavigate(true);
      
      // Data is prepared - now wait for account extraction to complete
      // Navigation will happen via the onProcessingComplete callback
      setProcessingMessage("Finalizing account data extraction...");
    },
    useAI: true,
    onProcessingStart: () => {
      setReadyToNavigate(false);
      setIsProcessing(true);
      setProcessingMessage(undefined); // Reset message to use default based on progress
    },
    onProcessingComplete: () => {
      console.log("All processing complete including table extraction");
      // We're now fully ready to navigate to the report view
      onProcessingComplete();
    },
    onError: (error) => {
      console.error("PDF processing error:", error);
      setLoadError(error?.message || "Failed to process the PDF file. Please try again.");
      setIsProcessing(false);
    }
  });

  // Effect to adjust processing message based on progress
  useEffect(() => {
    if (uploadProgress >= 85 && uploadProgress < 95) {
      setProcessingMessage("Extracting credit account details...");
    } else if (uploadProgress >= 95 && uploadProgress < 100) {
      setProcessingMessage("Finalizing data extraction...");
    } else if (uploadProgress >= 100) {
      setProcessingMessage("Processing complete!");
    }
  }, [uploadProgress]);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {loadError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Processing PDF</AlertTitle>
          <AlertDescription>
            {loadError}
            <div className="mt-2 text-sm">
              This might be due to a network issue or a problem with the PDF library.
              Please try refreshing the page and uploading the file again.
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div
        className={cn(
          "pdf-drop-area flex flex-col items-center justify-center",
          isDragging && "active",
          loadError && "border-red-300"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".pdf"
          className="hidden"
          disabled={isProcessing}
        />
        
        {currentFile && uploadProgress > 0 ? (
          <PDFProgressDisplay 
            file={currentFile} 
            progress={uploadProgress}
            error={processingError}
            isProcessing={isProcessing}
            processingMessage={processingMessage}
          />
        ) : (
          <PDFUploadPlaceholder 
            triggerFileInput={triggerFileInput} 
            isProcessing={isProcessing}
          />
        )}
      </div>
    </div>
  );
};

export default PDFUploader;
