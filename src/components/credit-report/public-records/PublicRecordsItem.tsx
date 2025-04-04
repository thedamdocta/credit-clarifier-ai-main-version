
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, FileText, MessageSquare, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PublicRecordDetails from "./PublicRecordDetails";
import PublicRecordComments from "./PublicRecordComments";

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

interface PublicRecordsItemProps {
  record: PublicRecord;
  recordType: "Bankruptcy" | "Judgement" | "Lien";
  showDebugInfo: boolean;
}

const PublicRecordsItem: React.FC<PublicRecordsItemProps> = ({ record, recordType, showDebugInfo }) => {
  const [activeTab, setActiveTab] = useState("details");
  
  // Determine if record has negative information - all public records are negative
  const hasNegativeInfo = true;
  
  // Set card styling based on record type
  const getCardStyle = () => {
    switch (recordType) {
      case "Bankruptcy":
        return "border-red-200 bg-red-50/50";
      case "Judgement":
        return "border-amber-200 bg-amber-50/50";
      case "Lien":
        return "border-blue-200 bg-blue-50/50";
      default:
        return "border-red-200 bg-red-50/50";
    }
  };

  // Set title style based on record type
  const getTitleStyle = () => {
    switch (recordType) {
      case "Bankruptcy":
        return "text-red-700";
      case "Judgement":
        return "text-amber-700";
      case "Lien":
        return "text-blue-700";
      default:
        return "text-red-700";
    }
  };

  return (
    <Card className={getCardStyle()}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className={`text-lg flex items-center ${getTitleStyle()}`}>
            <AlertTriangle className="h-5 w-5 mr-2" />
            {recordType}
            <Badge variant="outline" className="ml-2">
              {record.caseNumber || "Not reported"}
            </Badge>
          </CardTitle>
          
          <Badge 
            variant={hasNegativeInfo ? "destructive" : "outline"}
            className={`${hasNegativeInfo ? 'bg-red-100 text-red-800 hover:bg-red-200' : ''}`}
          >
            {record.status || "Not reported"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="details" onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="details">
              <FileText className="h-4 w-4 mr-1" />
              Details
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4 mr-1" />
              Comments
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details">
            <PublicRecordDetails record={record} recordType={recordType} showDebugInfo={showDebugInfo} />
          </TabsContent>
          
          <TabsContent value="comments">
            <PublicRecordComments record={record} showDebugInfo={showDebugInfo} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PublicRecordsItem;
