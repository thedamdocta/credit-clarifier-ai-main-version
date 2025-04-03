
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { usePDFUpload } from "@/hooks/usePDFUpload";
import PDFUploadPlaceholder from "./PDFUploadPlaceholder";
import PDFProgressDisplay from "./PDFProgressDisplay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { OpenAIConfigForm, canUseOpenAI } from "@/lib/ai/openai/openaiService";

interface PDFUploaderProps {
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ 
  onPDFUploaded, 
  isProcessing,
  setIsProcessing 
}) => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOpenAIConfig, setShowOpenAIConfig] = useState(true);
  const [processingComplete, setProcessingComplete] = useState(false);
  
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
    processingError
  } = usePDFUpload({ 
    onPDFUploaded: (file, text, parsedReport) => {
      // Mark processing as complete first, then notify parent
      setProcessingComplete(true);
      
      // Small delay to ensure UI updates before notifying parent
      setTimeout(() => {
        onPDFUploaded(file, text, parsedReport);
      }, 300);
    },
    useAI: true, // Enable AI-powered extraction
    onProcessingStart: () => {
      setProcessingComplete(false);
      setIsProcessing(true);
    },
    onProcessingComplete: () => {
      setIsProcessing(false);
    },
    onError: (error) => {
      console.error("PDF processing error:", error);
      setLoadError(error?.message || "Failed to process the PDF file. Please try again.");
      setIsProcessing(false);
    }
  });

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
            ? "AI-powered extraction is enabled. You can provide your own API key or use our built-in key." 
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
          <PDFProgressDisplay 
            file={currentFile} 
            progress={uploadProgress}
            error={processingError}
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
