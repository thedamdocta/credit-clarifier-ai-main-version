
import React, { useState } from "react";
import { Image, ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";

interface TableImageDisplayProps {
  tableImageUrl: string | null;
}

const TableImageDisplay: React.FC<TableImageDisplayProps> = ({ tableImageUrl }) => {
  const [zoomed, setZoomed] = useState(false);
  const [focusOnTable, setFocusOnTable] = useState(false);

  if (!tableImageUrl) {
    return null;
  }
  
  return (
    <div className="mb-4 border rounded-md p-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground flex items-center">
          <Image className="h-4 w-4 mr-1" />
          Extracted Table Image:
        </p>
        
        <div className="flex gap-1">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setFocusOnTable(!focusOnTable)} 
            title={focusOnTable ? "View full image" : "Focus on accounts table"}
          >
            {focusOnTable ? <Maximize className="h-3.5 w-3.5" /> : <Minimize className="h-3.5 w-3.5" />}
          </Button>
          
          <Button 
            variant="outline" 
            size="icon" 
            className="h-7 w-7" 
            onClick={() => setZoomed(!zoomed)}
            title={zoomed ? "Zoom out" : "Zoom in"}
          >
            {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      
      <div className={`overflow-auto border rounded-md bg-background ${zoomed ? 'max-h-[600px]' : 'max-h-[300px]'}`}>
        <div className={`relative ${zoomed ? 'scale-100' : 'scale-90'} transition-transform`}>
          <AspectRatio ratio={16/9} className={`bg-muted ${focusOnTable ? 'hidden' : 'block'}`}>
            <img 
              src={tableImageUrl} 
              alt="Extracted credit report" 
              className="rounded-md object-contain w-full h-full" 
            />
          </AspectRatio>
          
          {focusOnTable && (
            <div className="relative bg-muted rounded-md">
              <img 
                src={tableImageUrl} 
                alt="Accounts table section" 
                className="rounded-md object-contain w-full"
                style={{
                  clipPath: "inset(485px 0px 370px 0px)", /* top right bottom left */
                  transform: "scale(1.2)",
                  transformOrigin: "center top",
                  margin: "0 auto",
                  maxHeight: zoomed ? "500px" : "250px"
                }}
              />
              <div className="absolute bottom-0 right-0 bg-background/80 text-xs p-1 rounded-tl">
                Focused on accounts table
              </div>
            </div>
          )}
        </div>
      </div>
      
      <p className="text-xs mt-1 text-muted-foreground">
        Note: The extraction is capturing the entire page instead of just the accounts table.
        Use the focus button to view just the accounts table section.
      </p>
    </div>
  );
};

export default TableImageDisplay;
