
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
const AccountHeader: React.FC = () => {
  return (
    <>
      <div>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Accounts
        </CardTitle>
        <CardDescription>Detailed information about accounts on your credit report</CardDescription>
      </div>
    </>
  );
};

export default AccountHeader;
