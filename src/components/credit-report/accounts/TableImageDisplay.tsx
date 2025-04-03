
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";

interface TableImageDisplayProps {
  imageUrl: string | null;
  showDebugInfo: boolean;
}

const TableImageDisplay: React.FC<TableImageDisplayProps> = ({ imageUrl, showDebugInfo }) => {
  const [enlargeImage, setEnlargeImage] = useState(false);
  
  if (!showDebugInfo || !imageUrl) return null;
  
  return (
    <div className="mb-6 border rounded-lg p-2 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">Extracted Table Image</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setEnlargeImage(!enlargeImage)}
        >
          {enlargeImage ? (
            <>
              <ZoomOut className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Reduce</span>
            </>
          ) : (
            <>
              <ZoomIn className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Enlarge</span>
            </>
          )}
        </Button>
      </div>
      <div className={`relative overflow-auto border ${enlargeImage ? 'h-[500px]' : 'h-[250px]'}`}>
        <img 
          src={imageUrl} 
          alt="Extracted Account Table" 
          className={`max-w-full ${enlargeImage ? 'h-auto' : 'h-full'} object-contain mx-auto`}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            console.error("Error loading table image");
          }}
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        This image is used for extracting the account data table
      </div>
    </div>
  );
};

export default TableImageDisplay;
