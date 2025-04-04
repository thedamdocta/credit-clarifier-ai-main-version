
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inquiry } from "@/lib/types/creditReport";
import HardInquiriesTable from "./HardInquiriesTable";
import SoftInquiriesTable from "./SoftInquiriesTable";
import InquiriesDataDebug from "./InquiriesDataDebug";

interface InquiriesListProps {
  hardInquiries: Inquiry[];
  softInquiries: Inquiry[];
  showDebugInfo: boolean;
  tableImageUrl?: string | null;
}

const InquiriesList: React.FC<InquiriesListProps> = ({ 
  hardInquiries, 
  softInquiries, 
  showDebugInfo,
  tableImageUrl
}) => {
  return (
    <div className="space-y-4">
      {showDebugInfo && (
        <InquiriesDataDebug 
          hardInquiries={hardInquiries} 
          softInquiries={softInquiries}
          tableImageUrl={tableImageUrl}
        />
      )}
      
      <Tabs defaultValue="hard" className="space-y-4">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="hard">Hard Inquiries</TabsTrigger>
          <TabsTrigger value="soft">Soft Inquiries</TabsTrigger>
        </TabsList>
        
        <TabsContent value="hard" className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-md">
            <p className="text-sm text-yellow-700">
              Hard inquiries occur when a lender checks your credit as part of the loan application process.
              These inquiries may impact your credit score and typically remain on your report for 2 years.
            </p>
          </div>
          
          {hardInquiries.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-md text-center">
              <p className="text-sm text-slate-700">No hard inquiries found in your report. We're showing sample data for testing.</p>
            </div>
          ) : null}
          
          <HardInquiriesTable inquiries={hardInquiries} />
        </TabsContent>
        
        <TabsContent value="soft" className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
            <p className="text-sm text-blue-700">
              Soft inquiries occur when your credit is checked for reasons other than lending decisions, such as background checks or pre-approved offers.
              These inquiries don't affect your credit score and are only visible to you.
            </p>
          </div>
          
          {softInquiries.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-md text-center">
              <p className="text-sm text-slate-700">No soft inquiries found in your report. We're showing sample data for testing.</p>
            </div>
          ) : null}
          
          <SoftInquiriesTable inquiries={softInquiries} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InquiriesList;
