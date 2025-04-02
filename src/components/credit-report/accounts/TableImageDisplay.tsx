
import React from "react";
import { Image } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface TableImageDisplayProps {
  tableImageUrl: string | null;
}

const TableImageDisplay: React.FC<TableImageDisplayProps> = ({ tableImageUrl }) => {
  if (!tableImageUrl) {
    return null;
  }
  
  return (
    <div className="mb-4 border rounded-md p-2">
      <p className="text-xs mb-1 text-muted-foreground flex items-center">
        <Image className="h-4 w-4 mr-1" />
        Extracted Table Image:
      </p>
      <AspectRatio ratio={16/9} className="bg-muted">
        <img 
          src={tableImageUrl} 
          alt="Extracted table" 
          className="rounded-md object-contain w-full h-full" 
        />
      </AspectRatio>
    </div>
  );
};

export default TableImageDisplay;
