
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collection } from "@/lib/types/creditReport";
import { Code } from "lucide-react";
import { extractCreditAccountsTableImage, getCurrentPDFData } from "@/utils/pdf/extractText";

interface CollectionsDataDebugProps {
  collections: Collection[];
}

const CollectionsDataDebug: React.FC<CollectionsDataDebugProps> = ({ collections }) => {
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Use existing extractCreditAccountsTableImage function but for collections data
    const fetchTableImage = async () => {
      try {
        const currentPdfData = getCurrentPDFData();
        if (currentPdfData.pdfDocument) {
          // We reuse the credit accounts table extraction function for collections
          // since collections tables are similarly formatted in credit reports
          const imageUrl = await extractCreditAccountsTableImage({
            bureau: 'Equifax',
            collections: collections
          });
          setTableImageUrl(imageUrl);
        }
      } catch (error) {
        console.error("Error fetching collections table image:", error);
      }
    };

    fetchTableImage();
  }, [collections]);

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
          <h5 className="text-xs font-medium mb-2">Extracted Table Image</h5>
          {tableImageUrl ? (
            <img 
              src={tableImageUrl} 
              alt="Extracted collections table" 
              className="max-w-full h-auto border rounded"
            />
          ) : (
            <div className="bg-slate-100 p-4 rounded text-center text-xs text-slate-500">
              [Collection table extraction image would appear here]
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CollectionsDataDebug;
