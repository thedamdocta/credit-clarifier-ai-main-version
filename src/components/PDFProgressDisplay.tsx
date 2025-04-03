
import React from "react";
import { Progress } from "@/components/ui/progress";
import { File, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFProgressDisplayProps {
  file: File;
  progress: number;
  error?: string | null;
  isProcessing?: boolean;
  processingMessage?: string;
}

const PDFProgressDisplay: React.FC<PDFProgressDisplayProps> = ({
  file,
  progress,
  error,
  isProcessing,
  processingMessage
}) => {
  const handleReloadPage = () => {
    window.location.reload();
  };
  
  // Calculate appropriate processing message based on progress
  const getMessage = () => {
    if (processingMessage) return processingMessage;
    
    if (progress < 30) return "Extracting text from PDF...";
    if (progress < 50) return "Analyzing report structure...";
    if (progress < 70) return "Extracting account details...";
    if (progress < 85) return "Processing credit account data...";
    if (progress < 95) return "Finalizing data extraction...";
    return "Processing complete, preparing to display your report...";
  };
  
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center space-x-3">
        <File className="h-10 w-10 text-credit-blue" />
        <div className="flex-1">
          <p className="text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
        </div>
      </div>
      
      {error ? (
        <div className="bg-red-50 p-3 rounded border border-red-200">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-800">Processing Error</p>
              <p className="text-xs text-red-700">{error}</p>
              
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="outline" onClick={handleReloadPage} className="mt-1">
                  <svg className="h-3.5 w-3.5 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reload Page
                </Button>
                <Button size="sm" variant="ghost" onClick={() => window.location.href = '/'} className="mt-1">
                  Start Over
                </Button>
              </div>
              <p className="text-xs text-red-600 mt-2">
                This might be due to network issues or browser restrictions.
                Try using a different browser if the issue persists.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                {getMessage()}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <Progress value={progress} className="h-full absolute top-0 left-0" />
            </div>
          </div>
          
          {isProcessing && (
            <div className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span className="text-xs text-muted-foreground">{getMessage()}</span>
            </div>
          )}
          
          {progress >= 100 && (
            <div className="text-xs text-center text-credit-blue font-medium mt-1">
              Analysis complete! Preparing your report...
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PDFProgressDisplay;
