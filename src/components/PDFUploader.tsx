
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePDFUpload } from "@/hooks/usePDFUpload";
import PDFUploadPlaceholder from "./PDFUploadPlaceholder";
import PDFProgressDisplay from "./PDFProgressDisplay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OpenAIConfigForm, canUseOpenAI } from "@/lib/ai/openai/openaiService";

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
  const [showOpenAIConfig, setShowOpenAIConfig] = useState(true);
  const [readyToNavigate, setReadyToNavigate] = useState(false);
  
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
      // Process is complete - ready to navigate
      onPDFUploaded(file, text, parsedReport);
      setReadyToNavigate(true);
    },
    useAI: true, // Enable enhanced extraction
    onProcessingStart: () => {
      setReadyToNavigate(false);
      setIsProcessing(true);
    },
    onProcessingComplete: () => {
      // Wait until processing is fully complete before navigating
      setIsProcessing(false);
      
      // Delay navigation slightly to ensure UI is updated
      setTimeout(() => {
        if (onProcessingComplete && processingComplete) {
          onProcessingComplete();
        }
      }, 500);
    },
    onError: (error) => {
      console.error("PDF processing error:", error);
      setLoadError(error?.message || "Failed to process the PDF file. Please try again.");
      setIsProcessing(false);
    }
  });

  // Manual view report button handler
  const handleViewReport = () => {
    if (readyToNavigate && !isProcessing) {
      onProcessingComplete();
    }
  };

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
      
      {showOpenAIConfig && (
        <div className="mb-4 border rounded-md p-4">
          <h3 className="font-medium text-sm mb-2">OpenAI API Configuration</h3>
          <p className="text-xs mb-3">{canUseOpenAI() 
            ? "Enhanced extraction is enabled. You can provide your own API key or use our built-in key." 
            : "For best results, provide an OpenAI API key for enhanced table detection."}</p>
          <OpenAIConfigForm />
        </div>
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
          <>
            <PDFProgressDisplay 
              file={currentFile} 
              progress={uploadProgress}
              error={processingError}
              isProcessing={isProcessing}
              onProcessingComplete={handleViewReport}
            />
            
            {readyToNavigate && !isProcessing && !processingError && (
              <div className="mt-6">
                <Button onClick={handleViewReport} className="pulse-animation">
                  View Your Credit Report
                </Button>
              </div>
            )}
          </>
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
