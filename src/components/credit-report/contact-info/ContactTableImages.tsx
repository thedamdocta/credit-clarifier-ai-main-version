
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";

interface ContactTableImagesProps {
  tableImages: string[];
  isExtracting: boolean;
  onExtractTableImages: () => void;
  imageLoadStatus: Record<number, boolean>;
  onImageLoad: (index: number) => void;
  onImageError: (index: number) => void;
}

const ContactTableImages: React.FC<ContactTableImagesProps> = ({ 
  tableImages, 
  isExtracting, 
  onExtractTableImages, 
  imageLoadStatus,
  onImageLoad,
  onImageError
}) => {
  return (
    <div className="mt-6 border rounded-lg p-3 bg-gray-50 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium">Contact Information Images</h3>
        <Button
          variant="default"
          size="sm"
          onClick={onExtractTableImages}
          disabled={isExtracting}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isExtracting ? 'animate-spin' : ''}`} />
          <span className="text-xs">{isExtracting ? 'Extracting...' : 'Extract Tables'}</span>
        </Button>
      </div>
      
      {tableImages.length > 0 ? (
        <div className="space-y-4">
          {tableImages.map((imageUrl, index) => (
            <div key={`contact-img-${index}`} className="border rounded-md overflow-hidden bg-white">
              <div className="bg-muted/30 p-2 flex justify-between items-center">
                <span className="text-xs font-medium">Contact Table Image {index + 1}</span>
                <span className="text-xs">
                  {imageLoadStatus[index] === true && (
                    <span className="text-green-600">✓ Loaded</span>
                  )}
                  {imageLoadStatus[index] === false && (
                    <span className="text-red-500">✗ Failed</span>
                  )}
                  {imageLoadStatus[index] === undefined && (
                    <span className="text-amber-500">⋯ Loading</span>
                  )}
                </span>
              </div>
              <div className="relative overflow-auto h-[250px]">
                <img 
                  src={imageUrl} 
                  alt={`Contact information table ${index + 1}`} 
                  className="h-full object-contain mx-auto"
                  onLoad={() => onImageLoad(index)}
                  onError={() => onImageError(index)}
                />
              </div>
              <div className="p-2 flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                    View Full Image
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 border rounded-md bg-white">
          {isExtracting ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Extracting contact information tables...</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Click "Extract Tables" to extract contact information tables from the PDF.
              </p>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-2 text-xs text-muted-foreground">
        <p>This feature extracts contact information tables from the PDF to improve data accuracy.</p>
      </div>
    </div>
  );
};

export default ContactTableImages;
