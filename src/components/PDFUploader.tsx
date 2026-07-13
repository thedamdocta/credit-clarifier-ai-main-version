import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { usePDFUpload } from "@/hooks/usePDFUpload";
import PDFUploadPlaceholder from "./PDFUploadPlaceholder";
import PDFProgressDisplay from "./PDFProgressDisplay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface PDFUploaderProps {
  onPDFUploaded: (
    file: File,
    text: string,
    parsedReport?: any,
    options?: { onProgress?: (update: { progress: number; stage: string }) => void },
  ) => Promise<void> | void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  onProcessingComplete: () => void;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({
  onPDFUploaded,
  isProcessing,
  setIsProcessing,
  onProcessingComplete,
}) => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string | undefined>(undefined);

  const {
    isDragging,
    uploadProgress,
    currentFile,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    processingError,
    currentStage,
  } = usePDFUpload({
    onPDFUploaded: async (file, text, parsedReport, options) => {
      await onPDFUploaded(file, text, parsedReport, options);
    },
    useAI: true,
    onProcessingStart: () => {
      setLoadError(null);
      setProcessingMessage(undefined);
      setIsProcessing(true);
    },
    onProcessingComplete: () => {
      setIsProcessing(false);
      setProcessingMessage("Workspace ready.");
      onProcessingComplete();
    },
    onError: (error) => {
      setLoadError(error?.message || "Failed to process the PDF file. Please try again.");
      setProcessingMessage("Processing blocked.");
      setIsProcessing(false);
    },
  });

  const showSuccessState = !loadError && !processingError && !isProcessing && processingMessage === "Workspace ready.";

  return (
    <div className="w-full max-w-3xl mx-auto">
      {(loadError || processingError) && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Processing PDF</AlertTitle>
          <AlertDescription>
            {loadError || processingError}
          </AlertDescription>
        </Alert>
      )}

      <div
        className={cn(
          "pdf-drop-area relative flex flex-col items-center justify-center overflow-hidden",
          isDragging && "active",
          (loadError || processingError) && "border-red-300"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!currentFile && !isProcessing && (
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,application/pdf"
            aria-label="Upload credit report PDF"
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          />
        )}

        {currentFile && (isProcessing || uploadProgress > 0) ? (
          <PDFProgressDisplay
            file={currentFile}
            progress={uploadProgress}
            error={processingError || loadError}
            isProcessing={isProcessing}
            processingMessage={processingMessage ?? currentStage}
            showSuccessState={showSuccessState}
          />
        ) : (
          <PDFUploadPlaceholder
            isProcessing={isProcessing}
          />
        )}
      </div>
    </div>
  );
};

export default PDFUploader;
