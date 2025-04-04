
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface PublicRecord {
  recordType: string;
  caseNumber: string;
  filingDate: string;
  status: string;
  courtName?: string;
  agency?: string;
  liabilityAmount: number | null;
  comments: string[];
}

interface PublicRecordCommentsProps {
  record: PublicRecord;
  showDebugInfo: boolean;
}

const PublicRecordComments: React.FC<PublicRecordCommentsProps> = ({ record, showDebugInfo }) => {
  const comments = record.comments || ["No comments reported for this record."];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium flex items-center mb-2">
          <MessageSquare className="h-4 w-4 mr-1" />
          Comments
        </h3>
        <Card>
          <CardContent className="p-4">
            {comments.map((comment, index) => (
              <p key={index} className="text-sm mb-2 last:mb-0">{comment}</p>
            ))}
          </CardContent>
        </Card>
      </div>
      
      {showDebugInfo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
          <h4 className="text-sm font-medium mb-2">Debug Information</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify({ comments }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PublicRecordComments;
