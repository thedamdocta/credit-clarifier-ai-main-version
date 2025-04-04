
import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Inquiry } from "@/lib/types/creditReport";
import { Code, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InquiriesDataDebugProps {
  hardInquiries: Inquiry[];
  softInquiries: Inquiry[];
  tableImageUrl?: string | null;
}

const InquiriesDataDebug: React.FC<InquiriesDataDebugProps> = ({ 
  hardInquiries, 
  softInquiries,
  tableImageUrl
}) => {
  const [enlargeImage, setEnlargeImage] = useState(false);
  
  return (
    <Card className="bg-slate-50 border-slate-200 mb-4">
      <CardHeader className="py-2 px-4 bg-slate-100">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-medium text-slate-700">Inquiries Data Debug</h4>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h5 className="text-xs font-medium mb-2">Hard Inquiries ({hardInquiries.length})</h5>
            <div className="bg-slate-800 text-slate-200 p-3 rounded text-xs font-mono overflow-x-auto h-[150px] overflow-y-auto">
              <pre>{JSON.stringify(hardInquiries, null, 2)}</pre>
            </div>
          </div>
          <div>
            <h5 className="text-xs font-medium mb-2">Soft Inquiries ({softInquiries.length})</h5>
            <div className="bg-slate-800 text-slate-200 p-3 rounded text-xs font-mono overflow-x-auto h-[150px] overflow-y-auto">
              <pre>{JSON.stringify(softInquiries, null, 2)}</pre>
            </div>
          </div>
        </div>
        
        {tableImageUrl && (
          <div className="mt-3 p-3 border rounded bg-white">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-medium">Extracted Table Image</h5>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setEnlargeImage(!enlargeImage)}
                className="h-6 px-2 text-xs"
              >
                {enlargeImage ? (
                  <>
                    <ZoomOut className="h-3 w-3 mr-1" />
                    Reduce
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-3 w-3 mr-1" />
                    Enlarge
                  </>
                )}
              </Button>
            </div>
            <div className={`relative overflow-hidden border ${enlargeImage ? 'h-[400px]' : 'h-[200px]'}`}>
              <img 
                src={tableImageUrl} 
                alt="Inquiries table" 
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InquiriesDataDebug;
