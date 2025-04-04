
import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface InquiriesTableImageDisplayProps {
  imageUrl: string | null;
}

const InquiriesTableImageDisplay: React.FC<InquiriesTableImageDisplayProps> = ({ imageUrl }) => {
  if (!imageUrl) {
    return (
      <div className="p-4 border rounded-md bg-gray-50 mb-4">
        <div className="text-center py-4">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No table image extracted yet</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="border rounded-md p-4 mb-4 bg-gray-50">
      <h4 className="text-sm font-medium mb-2">Extracted Table Image (Debug Only)</h4>
      <div className="flex flex-col">
        <div className="relative border rounded bg-white overflow-hidden">
          <img 
            src={imageUrl} 
            alt="Extracted inquiries table" 
            className="w-full h-auto max-h-[300px] object-contain"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
              View Full Image
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InquiriesTableImageDisplay;
