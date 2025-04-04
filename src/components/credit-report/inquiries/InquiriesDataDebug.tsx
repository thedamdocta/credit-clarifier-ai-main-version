
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HardInquiry, SoftInquiry } from "@/lib/types/creditReport";
import { Code } from "lucide-react";

interface InquiriesDataDebugProps {
  hardInquiries: HardInquiry[];
  softInquiries: SoftInquiry[];
}

const InquiriesDataDebug: React.FC<InquiriesDataDebugProps> = ({ 
  hardInquiries, 
  softInquiries 
}) => {
  return (
    <Card className="bg-slate-50 border-slate-200 mb-4">
      <CardHeader className="py-2 px-4 bg-slate-100">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-medium text-slate-700">Inquiries Data Debug</h4>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="mb-4">
          <h5 className="text-xs font-medium mb-2">Hard Inquiries</h5>
          <div className="bg-slate-800 text-slate-200 p-3 rounded text-xs font-mono overflow-x-auto">
            <pre>{JSON.stringify(hardInquiries, null, 2)}</pre>
          </div>
        </div>
        
        <div className="mb-4">
          <h5 className="text-xs font-medium mb-2">Soft Inquiries</h5>
          <div className="bg-slate-800 text-slate-200 p-3 rounded text-xs font-mono overflow-x-auto">
            <pre>{JSON.stringify(softInquiries, null, 2)}</pre>
          </div>
        </div>
        
        <div className="mt-3 p-3 border rounded bg-white">
          <h5 className="text-xs font-medium mb-2">Extracted Table Image</h5>
          <div className="bg-slate-100 p-4 rounded text-center text-xs text-slate-500">
            [Inquiries table extraction image would appear here]
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InquiriesDataDebug;
