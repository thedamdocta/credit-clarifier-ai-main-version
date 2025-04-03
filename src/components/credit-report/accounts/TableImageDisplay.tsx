
import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface TableImageDisplayProps {
  imageUrl: string | null;
  showDebugInfo: boolean;
}

const TableImageDisplay: React.FC<TableImageDisplayProps> = ({ imageUrl, showDebugInfo }) => {
  if (!showDebugInfo || !imageUrl) {
    return null;
  }

  return (
    <div className="mb-6 border rounded-md p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Extracted Table Image</span>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs"
        >
          Reduce Size
        </Button>
      </div>
      <div className="overflow-auto max-h-[400px] border rounded-md">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt="Extracted credit accounts table" 
            className="max-w-full"
            onError={(e) => {
              console.error("Error loading table image");
              e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'></path><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'></path></svg>";
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default TableImageDisplay;
