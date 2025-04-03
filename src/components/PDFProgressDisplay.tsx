
import React, { useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { File, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFProgressDisplayProps {
  file: File;
  progress: number;
  error?: string | null;
  onProcessingComplete?: () => void;
}

const PDFProgressDisplay: React.FC<PDFProgressDisplayProps> = ({
  file,
  progress,
  error,
  onProcessingComplete
}) => {
  const handleReloadPage = () => {
    window.location.reload();
  };
  
  // When progress reaches 100%, trigger the onProcessingComplete callback
  useEffect(() => {
    if (progress >= 100 && onProcessingComplete) {
      // Add small delay to ensure UI updates first
      const timer = setTimeout(() => {
        onProcessingComplete();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [progress, onProcessingComplete]);

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
            <div>
              <p className="text-sm font-medium text-red-800 mb-1">Processing Error</p>
              <p className="text-xs text-red-700 mb-2">{error}</p>
              <Button size="sm" variant="outline" onClick={handleReloadPage}>
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      ) : progress >= 100 ? (
        <div className="bg-green-50 p-3 rounded border border-green-200">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
            <div>
              <p className="text-sm font-medium text-green-800 mb-1">Processing Complete</p>
              <p className="text-xs text-green-700">Your report is ready to view</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-center text-muted-foreground">
            {progress < 100 ? 
              `Processing PDF (${Math.round(progress)}%)...` : 
              "PDF processed successfully!"}
          </p>
        </>
      )}
    </div>
  );
};

export default PDFProgressDisplay;
