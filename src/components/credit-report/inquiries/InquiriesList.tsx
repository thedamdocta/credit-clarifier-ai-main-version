
import React from "react";
import { HardInquiry, SoftInquiry } from "@/lib/types/creditReport";
import InquiriesDataDebug from "./InquiriesDataDebug";
import HardInquiriesTable from "./HardInquiriesTable";
import SoftInquiriesTable from "./SoftInquiriesTable";

interface InquiriesListProps {
  hardInquiries: HardInquiry[];
  softInquiries: SoftInquiry[];
  showDebugInfo: boolean;
}

const InquiriesList: React.FC<InquiriesListProps> = ({ 
  hardInquiries,
  softInquiries, 
  showDebugInfo 
}) => {
  return (
    <div className="space-y-6">
      {showDebugInfo && (
        <InquiriesDataDebug 
          hardInquiries={hardInquiries} 
          softInquiries={softInquiries} 
        />
      )}
      
      <div>
        <h3 className="text-md font-medium mb-3">Hard Inquiries</h3>
        <p className="text-sm text-muted-foreground mb-4">
          These inquiries are visible to lenders and may impact your credit score for up to 2 years.
        </p>
        <HardInquiriesTable inquiries={hardInquiries} />
      </div>
      
      <div>
        <h3 className="text-md font-medium mb-3 mt-8">Soft Inquiries</h3>
        <p className="text-sm text-muted-foreground mb-4">
          These inquiries are only visible to you and do not affect your credit score.
        </p>
        <SoftInquiriesTable inquiries={softInquiries} />
      </div>
    </div>
  );
};

export default InquiriesList;
