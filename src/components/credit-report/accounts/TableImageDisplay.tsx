
import React from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface TableImageDisplayProps {
  imageUrl: string | null;
  showDebugInfo: boolean;
}

const TableImageDisplay: React.FC<TableImageDisplayProps> = ({ imageUrl, showDebugInfo }) => {
  if (!imageUrl || !showDebugInfo) return null;
  
  return (
    <div className="mb-4 border rounded-md p-2">
      <p className="text-xs mb-1 text-muted-foreground">Extracted Table Image:</p>
      <AspectRatio ratio={16/9} className="bg-muted">
        <img src={imageUrl} alt="Extracted table" className="rounded-md object-cover w-full h-full" />
      </AspectRatio>
    </div>
  );
};

export default TableImageDisplay;
