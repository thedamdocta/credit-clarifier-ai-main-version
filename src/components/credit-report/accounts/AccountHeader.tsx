
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";

interface AccountHeaderProps {
  showDebugInfo: boolean;
  toggleDebug: () => void;
}

const AccountHeader: React.FC<AccountHeaderProps> = ({ 
  showDebugInfo, 
  toggleDebug 
}) => {
  return (
    <>
      <div>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Accounts
        </CardTitle>
        <CardDescription>Detailed information about accounts on your credit report</CardDescription>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={toggleDebug}
        className="flex items-center text-xs"
      >
        <Bug className="h-3 w-3 mr-1" />
        {showDebugInfo ? "Hide Debug" : "Show Debug"}
      </Button>
    </>
  );
};

export default AccountHeader;
