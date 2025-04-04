
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Inquiry } from "@/lib/types/creditReport";
import HardInquiriesTable from "./HardInquiriesTable";
import SoftInquiriesTable from "./SoftInquiriesTable";
import InquiriesTableImageDisplay from "./InquiriesTableImageDisplay";

interface InquiriesListProps {
  hardInquiries: Inquiry[];
  softInquiries: Inquiry[];
  showDebugInfo: boolean;
}

const InquiriesList: React.FC<InquiriesListProps> = ({ hardInquiries, softInquiries, showDebugInfo }) => {
  const [activeTab, setActiveTab] = useState<string>("hard");
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  
  return (
    <div className="space-y-4">
      {showDebugInfo && (
        <InquiriesTableImageDisplay imageUrl={tableImageUrl} />
      )}
      
      <Tabs defaultValue="hard" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="hard" className="relative">
            Hard Inquiries
            <Badge className="ml-2 bg-red-100 text-red-600 hover:bg-red-100 absolute -top-2 -right-2 text-xs">
              {hardInquiries.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="soft">
            Soft Inquiries
            <Badge className="ml-2 bg-blue-100 text-blue-600 hover:bg-blue-100 absolute -top-2 -right-2 text-xs">
              {softInquiries.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="hard" className="pt-2">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-1">Hard Inquiries</h3>
            <p className="text-xs text-muted-foreground">
              These inquiries occur when a lender checks your credit report as part of their decision-making process. 
              Hard inquiries may impact your credit score for up to 12 months.
            </p>
          </div>
          
          <HardInquiriesTable inquiries={hardInquiries} />
        </TabsContent>
        
        <TabsContent value="soft" className="pt-2">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-1">Soft Inquiries</h3>
            <p className="text-xs text-muted-foreground">
              These inquiries occur when your credit is checked for reasons other than lending decisions, 
              such as background checks or pre-approved credit offers. Soft inquiries do not affect your credit score.
            </p>
          </div>
          
          <SoftInquiriesTable inquiries={softInquiries} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InquiriesList;
