
import React from "react";
import { Collection } from "@/lib/types/creditReport";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface CollectionDetailsProps {
  collection: Collection;
}

const CollectionDetails: React.FC<CollectionDetailsProps> = ({ collection }) => {
  // Add more details that might be available in the collection data
  const details = [
    { label: "Date Reported", value: collection.dateReported },
    { label: "Balance Date", value: collection.balanceDate },
    { label: "Account Designator Code", value: collection.accountDesignatorCode },
    { label: "Date Assigned", value: collection.dateAssigned },
    { label: "Account Number", value: collection.accountNumber },
    { label: "Original Amount Owed", value: collection.originalAmountOwed },
    { label: "Creditor Classification", value: collection.creditorClassification },
    { label: "Amount", value: collection.amount },
    { label: "Last Payment Date", value: collection.lastPaymentDate },
    { label: "Status Date", value: collection.statusDate },
    { label: "Date of First Delinquency", value: collection.dateOfFirstDelinquency },
    { label: "Status", value: collection.status },
  ];
  
  // Filter out any undefined contact information
  const contactInfo = collection.contact?.filter(Boolean) || [];
  
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium mb-2">Collection Account Details</h4>
      <Table>
        <TableBody>
          {details.map((detail, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium w-1/3 py-2">{detail.label}</TableCell>
              <TableCell className="py-2">{detail.value || "Not reported"}</TableCell>
            </TableRow>
          ))}
          
          {/* Only show contact section if there's contact info */}
          {contactInfo.length > 0 && (
            <TableRow>
              <TableCell className="font-medium w-1/3 py-2">Contact Information</TableCell>
              <TableCell className="py-2">
                {contactInfo.map((info, index) => (
                  <div key={index}>{info}</div>
                ))}
              </TableCell>
            </TableRow>
          )}
          
          {/* Only show comments section if there are comments */}
          {collection.comments && collection.comments.length > 0 && (
            <TableRow>
              <TableCell className="font-medium w-1/3 py-2">Comments</TableCell>
              <TableCell className="py-2">
                {collection.comments.map((comment, index) => (
                  <div key={index}>{comment}</div>
                ))}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CollectionDetails;
