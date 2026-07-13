
import React from "react";
import { Button } from "@/components/ui/button";
import { FileUp, Upload } from "lucide-react";

interface PDFUploadPlaceholderProps {
  isProcessing: boolean;
}

const PDFUploadPlaceholder: React.FC<PDFUploadPlaceholderProps> = ({
  isProcessing,
}) => {
  return (
    <>
      <Upload className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Upload Credit Report PDF</h3>
      <p className="text-muted-foreground text-sm mt-2 mb-4 text-center">
        Drag & drop your credit report PDF here, or click to browse
      </p>
      
      <Button type="button" disabled={isProcessing} className="pointer-events-none">
        <FileUp className="mr-2 h-4 w-4" />
        Select PDF
      </Button>
      
      <div className="mt-4 text-xs text-muted-foreground">
        Supports PDF files from Equifax, Experian, and TransUnion
      </div>
    </>
  );
};

export default PDFUploadPlaceholder;
