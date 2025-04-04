
import React from "react";
import { Collection } from "@/lib/types/creditReport";
import CollectionItem from "./CollectionItem";
import CollectionsDataDebug from "./CollectionsDataDebug";

interface CollectionsListProps {
  collections: Collection[];
  showDebugInfo: boolean;
}

const CollectionsList: React.FC<CollectionsListProps> = ({ collections, showDebugInfo }) => {
  if (collections.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">No collection accounts found in your report.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showDebugInfo && <CollectionsDataDebug collections={collections} />}
      
      {collections.map((collection, index) => (
        <CollectionItem 
          key={`collection-${index}`} 
          collection={collection} 
          index={index}
        />
      ))}
    </div>
  );
};

export default CollectionsList;
