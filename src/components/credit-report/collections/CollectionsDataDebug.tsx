
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collection } from "@/lib/types/creditReport";
import { Code, Image as ImageIcon } from "lucide-react";
import { extractCollectionsTableImage } from "@/utils/pdf/extractText";

interface CollectionsDataDebugProps {
  collections: Collection[];
}

const CollectionsDataDebug: React.FC<CollectionsDataDebugProps> = ({ collections }) => {
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadCollectionImage() {
      try {
        console.log('Attempting to extract collection table image for debug display');
        const imageUrl = await extractCollectionsTableImage({});
        if (imageUrl) {
          console.log('Successfully extracted collection table image for debug display');
          setTableImageUrl(imageUrl);
        }
      } catch (error) {
        console.error('Error extracting collection table image for debug:', error);
      }
    }
    
    loadCollectionImage();
  }, []);

  return (
    <Card className="bg-slate-50 border-slate-200 mb-4">
      <CardHeader className="py-2 px-4 bg-slate-100">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-medium text-slate-700">Collection Data Debug</h4>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="bg-slate-800 text-slate-200 p-3 rounded text-xs font-mono overflow-x-auto">
          <pre>{JSON.stringify(collections, null, 2)}</pre>
        </div>
        
        <div className="mt-3 p-3 border rounded bg-white">
          <h5 className="text-xs font-medium mb-2">Extracted Collection Table Image</h5>
          {tableImageUrl ? (
            <div className="bg-slate-100 rounded overflow-hidden">
              <img 
                src={tableImageUrl} 
                alt="Collection table from PDF" 
                className="w-full h-auto"
                onError={() => console.error("Error loading collection table image")}
              />
            </div>
          ) : (
            <div className="bg-slate-100 p-4 rounded text-center text-xs text-slate-500 flex items-center justify-center">
              <ImageIcon className="h-4 w-4 mr-2 text-slate-400" />
              No collection table image available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CollectionsDataDebug;
