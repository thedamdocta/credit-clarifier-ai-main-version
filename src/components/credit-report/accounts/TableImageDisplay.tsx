
import React from "react";

interface TableImageDisplayProps {
  imageUrl: string | null;
  showDebugInfo: boolean;
}

const TableImageDisplay: React.FC<TableImageDisplayProps> = ({ 
  imageUrl, 
  showDebugInfo 
}) => {
  React.useEffect(() => {
    if (showDebugInfo) {
      console.log("TableImageDisplay - Image URL:", imageUrl);
    }
  }, [imageUrl, showDebugInfo]);

  if (!showDebugInfo || !imageUrl) {
    return null;
  }

  return (
    <div className="mb-6 border border-gray-200 p-2 rounded-md">
      <p className="text-sm font-medium mb-2">Debug: Extracted Table Image</p>
      <div className="bg-white border border-gray-300 rounded-md overflow-hidden">
        <img 
          src={imageUrl} 
          alt="Credit account table extraction" 
          className="max-w-full h-auto object-contain"
          onError={() => console.error("Failed to load table image:", imageUrl)} 
          onLoad={() => console.log("Successfully loaded table image")}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        This is the image used for extracting account data. If it's empty or incorrect, try uploading a better PDF.
      </p>
    </div>
  );
};

export default TableImageDisplay;
