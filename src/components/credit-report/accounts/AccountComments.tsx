
import React from "react";
import { Account } from "@/lib/types/creditReport";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone, MapPin } from "lucide-react";

interface AccountCommentsProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountComments: React.FC<AccountCommentsProps> = ({ account, showDebugInfo }) => {
  const comments = account.comments || ["No comments reported for this account."];
  const contactInfo = {
    phone: "Not available",
    address: "Not available"
  };

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
      
      <div>
        <h3 className="font-medium mb-2">Contact Information</h3>
        <div className="bg-background p-4 rounded-md border">
          <div className="flex items-start space-x-2 mb-2">
            <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <span>{contactInfo.phone}</span>
          </div>
          <div className="flex items-start space-x-2">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <span>{contactInfo.address}</span>
          </div>
        </div>
      </div>
      
      {showDebugInfo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
          <h4 className="text-sm font-medium mb-2">Debug Information</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify({ comments, contactInfo }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AccountComments;
