
import React from "react";
import { Progress } from "@/components/ui/progress";
import { File } from "lucide-react";

interface PDFProgressDisplayProps {
  file: File;
  progress: number;
  useAI: boolean;
}

const PDFProgressDisplay: React.FC<PDFProgressDisplayProps> = ({
  file,
  progress,
  useAI
}) => {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center space-x-3">
        <File className="h-10 w-10 text-credit-blue" />
        <div className="flex-1">
          <p className="text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
        </div>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-sm text-center text-muted-foreground">
        {progress < 100 ? 
          (useAI ? "Processing PDF with AI..." : "Processing PDF...") : 
          "PDF processed successfully!"}
      </p>
    </div>
  );
};

export default PDFProgressDisplay;
