
import React, { useState } from "react";
import { Collection } from "@/lib/types/creditReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, FileText, MessageSquare, FileImage } from "lucide-react";
import {
  humanizeExtractedText,
  isNotReportedValue,
} from "@/utils/formatters/accountValueFormatters";
import CollectionSummary from "./CollectionSummary";
import CollectionDetails from "./CollectionDetails";
import CollectionComments from "./CollectionComments";
import SourceReportViewer from "../source/SourceReportViewer";

interface CollectionItemProps {
  collection: Collection;
  sourceSessionId?: string | null;
}

const CollectionItem: React.FC<CollectionItemProps> = ({ collection, sourceSessionId }) => {
  const [activeTab, setActiveTab] = useState("summary");
  
  const collectionAgency = collection.collectionAgency || "Unknown Collection Agency";
  const accountNumber = collection.accountNumber || "Not reported";
  const statusText = humanizeExtractedText(collection.status) || "Not reported";
  
  return (
    <Card className="border-[#f0a8a0] bg-[#fff7f6]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-slate-900">
            <Building className="h-5 w-5 text-slate-500" />
            <span>{collectionAgency}</span>
            <Badge variant="outline" className={isNotReportedValue(accountNumber) ? "text-slate-400" : undefined}>
              {accountNumber}
            </Badge>
            <Badge variant="destructive">Negative Account</Badge>
          </CardTitle>
          <Badge variant="outline" className={isNotReportedValue(statusText) ? "text-slate-400" : undefined}>
            {statusText}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 max-w-full">
          <TabsTrigger value="summary">
            <Building className="h-3.5 w-3.5 mr-1" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="details">
            <FileText className="h-3.5 w-3.5 mr-1" />
            Collection Details
          </TabsTrigger>
          <TabsTrigger value="comments">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="source-report">
            <FileImage className="h-3.5 w-3.5 mr-1" />
            Source Report
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="mt-0">
          <CollectionSummary collection={collection} />
        </TabsContent>
        
        <TabsContent value="details" className="mt-0">
          <CollectionDetails collection={collection} />
        </TabsContent>
        
        <TabsContent value="comments" className="mt-0">
          <CollectionComments collection={collection} />
        </TabsContent>

        <TabsContent value="source-report" className="mt-0">
          {activeTab === "source-report" ? (
            <SourceReportViewer
              sessionId={sourceSessionId}
              pageNumbers={collection.sourcePages}
              title={`${collection.collectionAgency || "Collection"} Source Pages`}
              description="These are the report pages used to extract this collection. A page may appear in more than one collection or component."
            />
          ) : null}
        </TabsContent>
      </Tabs>
      </CardContent>
    </Card>
  );
};

export default CollectionItem;
