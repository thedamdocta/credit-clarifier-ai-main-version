
import React from 'react';
import { Account } from '@/lib/types/creditReport';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, MapPin, Phone } from 'lucide-react';

interface AccountCommentSectionProps {
  account: Account;
  isNegative: boolean;
}

const AccountCommentSection: React.FC<AccountCommentSectionProps> = ({ account, isNegative }) => {
  const hasComments = account.comments && account.comments.length > 0;
  const hasContactInfo = account.contactInfo && (
    account.contactInfo.name || 
    account.contactInfo.address || 
    account.contactInfo.phone
  );
  
  if (!hasComments && !hasContactInfo) {
    return (
      <div className="py-8 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <h3 className="font-medium text-lg mb-1">No Additional Information</h3>
        <p className="text-muted-foreground text-sm">
          No comments or contact information was provided for this account.
        </p>
      </div>
    );
  }
  
  return (
    <div className="py-4 space-y-6">
      {hasComments && (
        <div>
          <h3 className="font-medium text-lg mb-3">Comments</h3>
          <Card className={isNegative ? "border-red-200" : ""}>
            <CardContent className="pt-6 space-y-4">
              {account.comments?.map((comment, index) => (
                <div key={index} className="flex items-start gap-3">
                  <MessageSquare className={`h-5 w-5 mt-0.5 ${isNegative ? "text-red-500" : "text-credit-blue"}`} />
                  <div>
                    <p className="text-sm">{comment}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      
      {hasContactInfo && (
        <div>
          <h3 className="font-medium text-lg mb-3">Contact Information</h3>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {account.contactInfo?.name && (
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isNegative ? "bg-red-100" : "bg-blue-100"}`}>
                      <MessageSquare className={`h-4 w-4 ${isNegative ? "text-red-500" : "text-credit-blue"}`} />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Creditor Name</div>
                      <div className="font-medium">{account.contactInfo.name}</div>
                    </div>
                  </div>
                )}
                
                {account.contactInfo?.address && (
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${isNegative ? "bg-red-100" : "bg-blue-100"}`}>
                      <MapPin className={`h-4 w-4 ${isNegative ? "text-red-500" : "text-credit-blue"}`} />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Address</div>
                      <div className="font-medium">
                        {account.contactInfo.address}
                        {account.contactInfo.city && account.contactInfo.state && (
                          <div>
                            {account.contactInfo.city}, {account.contactInfo.state} {account.contactInfo.zip}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {account.contactInfo?.phone && (
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isNegative ? "bg-red-100" : "bg-blue-100"}`}>
                      <Phone className={`h-4 w-4 ${isNegative ? "text-red-500" : "text-credit-blue"}`} />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Phone</div>
                      <div className="font-medium">{account.contactInfo.phone}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AccountCommentSection;
