
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";

interface CreditAccountsHeaderProps {
  showDebugInfo: boolean;
  toggleDebug: () => void;
}

const CreditAccountsHeader: React.FC<CreditAccountsHeaderProps> = ({ 
  showDebugInfo, 
  toggleDebug 
}) => {
  return (
    <>
      <div>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Credit Accounts Summary
        </CardTitle>
        <CardDescription>Summary of your credit accounts</CardDescription>
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

export default CreditAccountsHeader;
