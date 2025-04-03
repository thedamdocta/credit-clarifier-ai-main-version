
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";

const OtherItemsHeader: React.FC = () => {
  return (
    <>
      <CardTitle className="flex items-center">
        <FileText className="h-5 w-5 mr-2" />
        Other Items Summary
      </CardTitle>
      <CardDescription>Additional information in your credit file</CardDescription>
    </>
  );
};

export default OtherItemsHeader;
