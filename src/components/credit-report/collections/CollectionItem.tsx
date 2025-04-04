
import React, { useState } from "react";
import { Collection } from "@/lib/types/creditReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bank, FileText, MessageSquare, Phone } from "lucide-react";
import CollectionSummary from "./CollectionSummary";
import CollectionDetails from "./CollectionDetails";
import CollectionComments from "./CollectionComments";

interface CollectionItemProps {
  collection: Collection;
  index: number;
}

const CollectionItem: React.FC<CollectionItemProps> = ({ collection, index }) => {
  const [activeTab, setActiveTab] = useState("summary");
  
  const collectionAgency = collection.collectionAgency || "Unknown Collection Agency";
  const accountNumber = collection.accountNumber || "Not reported";
  
  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bank className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-medium text-blue-600">{collectionAgency}</h3>
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
              {accountNumber}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {collection.status || "Not reported"}
          </div>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 px-4 pt-2">
          <TabsTrigger value="summary" className="text-xs flex items-center">
            <Bank className="h-3.5 w-3.5 mr-1" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="details" className="text-xs flex items-center">
            <FileText className="h-3.5 w-3.5 mr-1" />
            Collection Details
          </TabsTrigger>
          <TabsTrigger value="comments" className="text-xs flex items-center">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Comments
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="p-4">
          <CollectionSummary collection={collection} />
        </TabsContent>
        
        <TabsContent value="details" className="p-4">
          <CollectionDetails collection={collection} />
        </TabsContent>
        
        <TabsContent value="comments" className="p-4">
          <CollectionComments collection={collection} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CollectionItem;
