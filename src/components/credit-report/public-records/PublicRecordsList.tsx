
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import PublicRecordsDataDebug from "./PublicRecordsDataDebug";

interface PublicRecordsListProps {
  publicRecords: any;
  showDebugInfo: boolean;
  tableImageUrl?: string | null;
}

const PublicRecordsList: React.FC<PublicRecordsListProps> = ({ 
  publicRecords, 
  showDebugInfo,
  tableImageUrl
}) => {
  return (
    <div className="space-y-4">
      {showDebugInfo && (
        <PublicRecordsDataDebug 
          publicRecords={publicRecords} 
          tableImageUrl={tableImageUrl}
        />
      )}
      
      <Tabs defaultValue="bankruptcies">
        <TabsList className="mb-2 w-full">
          <TabsTrigger value="bankruptcies">Bankruptcies</TabsTrigger>
          <TabsTrigger value="judgements">Judgements</TabsTrigger>
          <TabsTrigger value="liens">Liens</TabsTrigger>
        </TabsList>
        
        {/* Bankruptcies tab */}
        <TabsContent value="bankruptcies">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-md mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
              <p className="text-sm text-blue-700">
                Bankruptcies can remain on your credit report for up to 10 years from the date of filing and can significantly impact your credit score.
              </p>
            </div>
          </div>
          
          {/* Display bankruptcy records */}
          {publicRecords.bankruptcies.map((bankruptcy: any, index: number) => (
            <div key={`bankruptcy-${index}`} className="border rounded-md p-4 mb-4">
              <h3 className="text-base font-medium mb-2">{bankruptcy.recordType || "Bankruptcy"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Case Number</p>
                  <p>{bankruptcy.caseNumber || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Filing Date</p>
                  <p>{bankruptcy.filingDate || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p>{bankruptcy.status || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Court</p>
                  <p>{bankruptcy.courtName || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Liability Amount</p>
                  <p>{bankruptcy.liabilityAmount || "Not reported"}</p>
                </div>
              </div>
              
              {bankruptcy.comments && bankruptcy.comments.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-1">Comments</p>
                  <ul className="text-sm space-y-1">
                    {bankruptcy.comments.map((comment: string, i: number) => (
                      <li key={`comment-${i}`} className="pl-2 border-l-2 border-gray-200">
                        {comment}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </TabsContent>
        
        {/* Judgements tab */}
        <TabsContent value="judgements">
          <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-md mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Judgements are court orders that require you to pay a debt and can remain on your credit report for up to 7 years.
              </p>
            </div>
          </div>
          
          {/* Display judgement records */}
          {publicRecords.judgements.map((judgement: any, index: number) => (
            <div key={`judgement-${index}`} className="border rounded-md p-4 mb-4">
              <h3 className="text-base font-medium mb-2">{judgement.recordType || "Judgement"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Case Number</p>
                  <p>{judgement.caseNumber || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Filing Date</p>
                  <p>{judgement.filingDate || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p>{judgement.status || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Court</p>
                  <p>{judgement.courtName || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Liability Amount</p>
                  <p>{judgement.liabilityAmount || "Not reported"}</p>
                </div>
              </div>
              
              {judgement.comments && judgement.comments.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-1">Comments</p>
                  <ul className="text-sm space-y-1">
                    {judgement.comments.map((comment: string, i: number) => (
                      <li key={`comment-${i}`} className="pl-2 border-l-2 border-gray-200">
                        {comment}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </TabsContent>
        
        {/* Liens tab */}
        <TabsContent value="liens">
          <div className="p-4 bg-red-50 border border-red-100 rounded-md mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">
                Liens are legal claims against property that can remain on your credit report for up to 7 years from the date of filing.
              </p>
            </div>
          </div>
          
          {/* Display lien records */}
          {publicRecords.liens.map((lien: any, index: number) => (
            <div key={`lien-${index}`} className="border rounded-md p-4 mb-4">
              <h3 className="text-base font-medium mb-2">{lien.recordType || "Lien"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Case Number</p>
                  <p>{lien.caseNumber || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Filing Date</p>
                  <p>{lien.filingDate || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p>{lien.status || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Agency</p>
                  <p>{lien.agency || "Not reported"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Liability Amount</p>
                  <p>{lien.liabilityAmount || "Not reported"}</p>
                </div>
              </div>
              
              {lien.comments && lien.comments.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-1">Comments</p>
                  <ul className="text-sm space-y-1">
                    {lien.comments.map((comment: string, i: number) => (
                      <li key={`comment-${i}`} className="pl-2 border-l-2 border-gray-200">
                        {comment}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PublicRecordsList;
