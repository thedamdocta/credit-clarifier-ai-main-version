
import React from "react";
import { Button } from "@/components/ui/button";
import { FileUp, Upload } from "lucide-react";

interface PDFUploadPlaceholderProps {
  triggerFileInput: () => void;
  isProcessing: boolean;
}

const PDFUploadPlaceholder: React.FC<PDFUploadPlaceholderProps> = ({
  triggerFileInput,
  isProcessing
}) => {
  return (
    <>
      <Upload className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Upload Credit Report PDF</h3>
      <p className="text-muted-foreground text-sm mt-2 mb-4 text-center">
        Drag & drop your credit report PDF here, or click to browse
      </p>
      <Button 
        onClick={triggerFileInput} 
        disabled={isProcessing}
        className="mt-2"
      >
        <FileUp className="mr-2 h-4 w-4" />
        Select PDF
      </Button>
      <div className="mt-4 text-xs text-muted-foreground">
        Supports PDF files from Equifax, Experian, and TransUnion with AI analysis
      </div>
    </>
  );
};

export default PDFUploadPlaceholder;
