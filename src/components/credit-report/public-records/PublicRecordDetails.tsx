
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, DollarSign, Building, FileText } from "lucide-react";

interface PublicRecord {
  recordType: string;
  caseNumber: string | null;
  filingDate: string;
  status: string;
  courtName?: string;
  agency?: string;
  liabilityAmount: number | null;
  comments: string[];
}

interface PublicRecordDetailsProps {
  record: PublicRecord;
  recordType: "Bankruptcy" | "Judgement" | "Lien";
  showDebugInfo: boolean;
}

const PublicRecordDetails: React.FC<PublicRecordDetailsProps> = ({ record, recordType, showDebugInfo }) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <div className="text-xs text-muted-foreground">Case/Reference Number</div>
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">
                  {record.caseNumber || "Not reported"}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-1">
              <div className="text-xs text-muted-foreground">Filing Date</div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">{record.filingDate || "Not reported"}</span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-1">
              <div className="text-xs text-muted-foreground">
                {recordType === "Lien" ? "Agency Name" : "Court Name"}
              </div>
              <div className="flex items-center">
                <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">
                  {recordType === "Lien" 
                    ? (record.agency || "Not reported") 
                    : (record.courtName || "Not reported")}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-1">
              <div className="text-xs text-muted-foreground">Liability Amount</div>
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">
                  {record.liabilityAmount ? `$${record.liabilityAmount.toLocaleString()}` : "Not reported"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {showDebugInfo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
          <h4 className="text-sm font-medium mb-2">Debug Information</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(record, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PublicRecordDetails;
