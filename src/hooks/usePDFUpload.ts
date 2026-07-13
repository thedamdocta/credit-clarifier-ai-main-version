import { useState, useRef } from "react";
import { toast } from "sonner";
import { processCreditReportPdfWithSessionApi, SessionProgressUpdate } from "@/lib/api/equifaxSessionClient";

const EXTRACTION_PROGRESS_MAX = 70;

interface UsePDFUploadProps {
  onPDFUploaded: (
    file: File,
    text: string,
    parsedReport?: any,
    options?: { onProgress?: (update: SessionProgressUpdate) => void },
  ) => Promise<void> | void;
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
  onProcessingComplete,
}: UsePDFUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>("Waiting for upload...");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewProgressTimerRef = useRef<number | null>(null);

  const stopReviewProgressTimer = () => {
    if (reviewProgressTimerRef.current !== null) {
      window.clearInterval(reviewProgressTimerRef.current);
      reviewProgressTimerRef.current = null;
    }
  };

  const syncProgress = (update: SessionProgressUpdate) => {
    const normalizedProgress = Math.max(Math.min(Math.round(update.progress), 100), 0);
    setUploadProgress((current) => Math.max(current, normalizedProgress));
    setCurrentStage(update.stage);

    const reviewingHighlightLocalization = /reviewing highlight localization/i.test(update.stage);
    if (reviewingHighlightLocalization && normalizedProgress >= 94 && normalizedProgress < 99) {
      if (reviewProgressTimerRef.current === null) {
        reviewProgressTimerRef.current = window.setInterval(() => {
          setUploadProgress((current) => {
            if (current >= 99) {
              stopReviewProgressTimer();
              return current;
            }
            return Math.min(current + 1, 99);
          });
        }, 1400);
      }
      return;
    }

    if (normalizedProgress >= 99 || !reviewingHighlightLocalization) {
      stopReviewProgressTimer();
    }
  };

  const processPDF = async (file: File) => {
    stopReviewProgressTimer();
    setProcessingError(null);
    setProcessingComplete(false);
    setUploadProgress(0);
    setCurrentFile(file);
    setCurrentStage("Creating secure processing session...");

    if (onProcessingStart) {
      onProcessingStart();
    }

    try {
      const { report } = await processCreditReportPdfWithSessionApi(file, (update) => {
        const scaledProgress = Math.min(
          EXTRACTION_PROGRESS_MAX,
          Math.round((Math.max(Math.min(update.progress, 100), 0) / 100) * EXTRACTION_PROGRESS_MAX),
        );
        syncProgress({ progress: scaledProgress, stage: update.stage });
      });

      if (!useAI) {
        // The revamp is backend-only; keeping this branch prevents API drift with existing prop shape.
      }

      setUploadProgress((current) => Math.max(current, 72));
      setCurrentStage("Preparing report workspace...");

      await onPDFUploaded(file, report.rawText || "", report, {
        onProgress: (update) => {
          syncProgress(update);
        },
      });

      stopReviewProgressTimer();
      setUploadProgress(100);
      setCurrentStage("Workspace ready.");
      setProcessingComplete(true);

      if (onProcessingComplete) {
        onProcessingComplete();
      }
    } catch (error) {
      stopReviewProgressTimer();
      const typedError = error as Error;
      const message = typedError.message || "Failed to process the PDF file. Please try again.";
      setProcessingError(message);
      setProcessingComplete(true);
      setCurrentStage("Processing blocked.");

      if (onError) {
        onError(typedError);
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
        void processPDF(file);
      } else {
        toast.error("Please upload a PDF file.");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const selectedFile = input.files?.[0] ?? null;

    // Reset immediately so selecting the same PDF again still triggers onChange.
    input.value = "";

    if (selectedFile) {
      void processPDF(selectedFile);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      // Clear stale selection so repeated uploads of the same file work.
      fileInputRef.current.value = "";
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
    processingError,
    processingComplete,
    currentStage,
  };
};
