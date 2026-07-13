
import React from "react";
import { Account } from "@/lib/types/creditReport";
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon, MessageSquare, Phone, MapPin } from "lucide-react";
import { isNotReportedValue } from "@/utils/formatters/accountValueFormatters";

interface AccountCommentsProps {
  account: Account;
  showDebugInfo: boolean;
}

const normalizeDisplayLine = (value: string) => value.replace(/\s+/g, " ").trim();

const uniqueDisplayLines = (values: string[]) => {
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = normalizeDisplayLine(value).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
};

const AccountComments: React.FC<AccountCommentsProps> = ({ account, showDebugInfo }) => {
  const meaningfulAdditionalInformation = uniqueDisplayLines(
    (account.additionalInformation || [])
      .map((entry) => normalizeDisplayLine(entry))
      .filter((entry) => entry.length > 0 && !isNotReportedValue(entry))
  );
  const meaningfulComments = uniqueDisplayLines(
    (account.comments || [])
      .map((comment) => normalizeDisplayLine(comment))
      .filter((comment) => comment.length > 0 && !isNotReportedValue(comment))
  );
  const comments = meaningfulComments.length > 0
    ? meaningfulComments
    : ["No comments reported for this account."];
  const contactLines = account.contact && account.contact.length > 0
    ? uniqueDisplayLines(account.contact.map((line) => normalizeDisplayLine(line)).filter(Boolean))
    : [];
  const phoneLines = contactLines.filter((line) => /(?:\(\d{3}\)\s*\d{3}-\d{4}|\d-\d{3}-\d{3}-\d{4}|\d{3}-\d{3}-\d{4})/.test(line));
  const otherContactLines = contactLines.filter((line) => !phoneLines.includes(line));

  return (
    <div className="space-y-4">
      {meaningfulAdditionalInformation.length > 0 ? (
        <div>
          <h3 className="font-medium flex items-center mb-2">
            <InfoIcon className="h-4 w-4 mr-1" />
            Additional Information
          </h3>
          <Card>
            <CardContent className="p-4">
              {meaningfulAdditionalInformation.map((entry, index) => (
                <p key={index} className="text-sm mb-2 last:mb-0">{entry}</p>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
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
          {contactLines.length > 0 ? (
            <div className="space-y-3">
              {phoneLines.map((line, index) => (
                <div key={`phone-${index}`} className="flex items-start space-x-2">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-sm">{line}</span>
                </div>
              ))}
              {otherContactLines.map((line, index) => (
                <div key={`contact-${index}`} className="flex items-start space-x-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span className="text-sm">{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No contact information reported for this account.</p>
          )}
        </div>
      </div>
      
      {showDebugInfo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
          <h4 className="text-sm font-medium mb-2">Debug Information</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify({ comments, contactLines }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AccountComments;
