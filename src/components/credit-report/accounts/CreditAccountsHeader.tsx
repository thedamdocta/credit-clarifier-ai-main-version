
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";

interface CreditAccountsHeaderProps {
  title?: string;
  description?: string;
  showDebugInfo: boolean;
  toggleDebug: () => void;
}

const CreditAccountsHeader: React.FC<CreditAccountsHeaderProps> = ({ 
  title = "Credit Accounts",
  description = "Summary of your credit accounts",
  showDebugInfo, 
  toggleDebug 
}) => {
  console.log("Header rendering with title:", title);
  
  return (
    <>
      <div>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
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
