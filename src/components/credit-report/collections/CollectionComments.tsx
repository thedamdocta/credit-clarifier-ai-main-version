
import React from "react";
import { Collection } from "@/lib/types/creditReport";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Phone } from "lucide-react";

interface CollectionCommentsProps {
  collection: Collection;
}

const CollectionComments: React.FC<CollectionCommentsProps> = ({ collection }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-1 mb-2">
          <MessageSquare className="h-4 w-4" />
          <h4 className="text-sm font-medium">Comments</h4>
        </div>
        
        {collection.comments && collection.comments.length > 0 ? (
          <Table>
            <TableBody>
              {collection.comments.map((comment, index) => (
                <TableRow key={index}>
                  <TableCell className="py-2 text-sm">{comment}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No comments reported</p>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-1 mb-2">
          <Phone className="h-4 w-4" />
          <h4 className="text-sm font-medium">Contact Information</h4>
        </div>
        
        {collection.contact && collection.contact.length > 0 ? (
          <Table>
            <TableBody>
              {collection.contact.map((contact, index) => (
                <TableRow key={index}>
                  <TableCell className="py-2 text-sm">{contact}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No contact information reported</p>
        )}
      </div>
    </div>
  );
};

export default CollectionComments;
