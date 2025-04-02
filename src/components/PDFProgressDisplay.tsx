
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
            <span>Processing PDF with AI... {Math.round(progress)}%</span>
          </>
        ) : (
          <span>PDF processed successfully!</span>
        )}
      </div>
    </div>
  );
};

export default PDFProgressDisplay;
