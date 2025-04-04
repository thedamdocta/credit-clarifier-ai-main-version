
import React, { useState } from "react";
import { Loader2, Maximize2 } from "lucide-react";
import { Collection } from "@/lib/types/creditReport";

interface CollectionsDataDebugProps {
  showDebugInfo: boolean;
  tableImageUrl: string | null;
  collections: Collection[];
  isProcessing: boolean;
  extractionFailed: boolean;
}

const CollectionsDataDebug: React.FC<CollectionsDataDebugProps> = ({
  showDebugInfo,
  tableImageUrl,
  collections,
  isProcessing,
  extractionFailed
}) => {
  const [expandedImage, setExpandedImage] = useState(false);

  if (!showDebugInfo) {
    return null;
  }

  return (
    <div className="border rounded p-4 mt-4 bg-gray-50">
      <h4 className="text-sm font-bold mb-2">Collections Debug Information</h4>
      
      <div className="mb-2">
        <span className="font-semibold">Table Image URL Available:</span> {tableImageUrl ? 'Yes' : 'No'}
      </div>
      
      {tableImageUrl && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Table Image:</span>
            <button 
              onClick={() => setExpandedImage(!expandedImage)} 
              className="text-xs flex items-center text-blue-600 hover:text-blue-800"
            >
              <Maximize2 className="h-3 w-3 mr-1" />
              {expandedImage ? "Reduce Size" : "Maximize"}
            </button>
          </div>
          <div className={expandedImage ? "border p-2 bg-white" : ""}>
            <img 
              src={tableImageUrl} 
              alt="Extracted Table" 
              className="max-w-full border rounded"
              style={{ 
                maxHeight: expandedImage ? '600px' : '300px', 
                objectFit: 'contain',
                width: expandedImage ? '100%' : 'auto'
              }}
            />
          </div>
        </div>
      )}
      
      <div className="mb-2">
        <span className="font-semibold">Extraction Failed:</span> {extractionFailed ? 'Yes' : 'No'}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Collections Count:</span> {collections?.length || 0}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Is Processing:</span> {isProcessing ? 'Yes' : 'No'}
      </div>
      
      {isProcessing && (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Extracting collections data...
        </div>
      )}
      
      {/* Display the current collections data */}
      {collections && collections.length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-bold mb-2">Current Collections Data:</h5>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(collections, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default CollectionsDataDebug;
