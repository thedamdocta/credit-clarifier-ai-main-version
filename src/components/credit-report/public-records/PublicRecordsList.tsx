
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import PublicRecordsItem from "./PublicRecordsItem";

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

interface PublicRecordsListProps {
  publicRecords: {
    bankruptcies: PublicRecord[];
    judgements: PublicRecord[];
    liens: PublicRecord[];
  };
  showDebugInfo: boolean;
}

const PublicRecordsList: React.FC<PublicRecordsListProps> = ({ publicRecords, showDebugInfo }) => {
  const [activeTab, setActiveTab] = useState<string>("bankruptcies");
  
  const { bankruptcies, judgements, liens } = publicRecords;
  
  return (
    <div className="space-y-4">
      <Tabs defaultValue="bankruptcies" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="bankruptcies" className="relative">
            Bankruptcies
            <Badge className="ml-2 bg-red-100 text-red-600 hover:bg-red-100 absolute -top-2 -right-2 text-xs">
              {bankruptcies.length || "0"}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="judgements" className="relative">
            Judgements
            <Badge className="ml-2 bg-amber-100 text-amber-600 hover:bg-amber-100 absolute -top-2 -right-2 text-xs">
              {judgements.length || "0"}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="liens" className="relative">
            Liens
            <Badge className="ml-2 bg-blue-100 text-blue-600 hover:bg-blue-100 absolute -top-2 -right-2 text-xs">
              {liens.length || "0"}
            </Badge>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="bankruptcies" className="pt-2">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-1">Bankruptcy Records</h3>
            <p className="text-xs text-muted-foreground">
              These records show any bankruptcies that have been reported to credit bureaus.
              Bankruptcies typically remain on your credit report for 7-10 years.
            </p>
          </div>
          
          <div className="space-y-6">
            {bankruptcies.map((record, index) => (
              <PublicRecordsItem 
                key={`bankruptcy-${index}`} 
                record={record} 
                recordType="Bankruptcy"
                showDebugInfo={showDebugInfo}
              />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="judgements" className="pt-2">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-1">Judgement Records</h3>
            <p className="text-xs text-muted-foreground">
              These records show any court judgements against you that have been reported to credit bureaus.
              Judgements typically remain on your credit report for 7 years.
            </p>
          </div>
          
          <div className="space-y-6">
            {judgements.map((record, index) => (
              <PublicRecordsItem 
                key={`judgement-${index}`} 
                record={record} 
                recordType="Judgement"
                showDebugInfo={showDebugInfo}
              />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="liens" className="pt-2">
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-1">Lien Records</h3>
            <p className="text-xs text-muted-foreground">
              These records show any tax liens or other liens that have been reported to credit bureaus.
              Liens typically remain on your credit report for 7 years from the date of filing.
            </p>
          </div>
          
          <div className="space-y-6">
            {liens.map((record, index) => (
              <PublicRecordsItem 
                key={`lien-${index}`} 
                record={record} 
                recordType="Lien"
                showDebugInfo={showDebugInfo}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PublicRecordsList;
