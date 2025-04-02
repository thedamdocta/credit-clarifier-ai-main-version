
import React from "react";
import { Progress } from "@/components/ui/progress";
import { File, Loader2 } from "lucide-react";

interface PDFProgressDisplayProps {
  file: File;
  progress: number;
}

const PDFProgressDisplay: React.FC<PDFProgressDisplayProps> = ({
  file,
  progress
}) => {
  const formattedFileSize = React.useMemo(() => {
    const sizeInKB = Math.round(file.size / 1024);
    return sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(2)} MB` : `${sizeInKB} KB`;
  }, [file.size]);

  const getProgressMessage = () => {
    if (progress < 10) return "Initializing PDF reader...";
    if (progress < 20) return "Reading PDF file...";
    if (progress < 30) return "Processing PDF document...";
    if (progress < 40) return "Extracting page images...";
    if (progress < 50) return "Reading document text...";
    if (progress < 60) return "Processing text content...";
    if (progress < 70) return "Analyzing document structure...";
    if (progress < 80) return "Extracting credit data...";
    if (progress < 90) return "Finalizing report extraction...";
    if (progress < 100) return "Completing process...";
    return "PDF processed successfully!";
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center space-x-3">
        <File className="h-10 w-10 text-credit-blue" />
        <div className="flex-1">
          <p className="text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formattedFileSize}</p>
        </div>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="flex items-center justify-center text-sm text-muted-foreground">
        {progress < 100 ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <span>{getProgressMessage()}</span>
            <span className="ml-1 text-xs font-mono">({Math.round(progress)}%)</span>
          </>
        ) : (
          <span>PDF processed successfully!</span>
        )}
      </div>
    </div>
  );
};

export default PDFProgressDisplay;
