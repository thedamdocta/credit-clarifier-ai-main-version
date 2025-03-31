
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

const AIAnalysisHeader: React.FC = () => {
  return (
    <>
      <CardTitle className="flex items-center text-yellow-700">
        <AlertCircle className="h-5 w-5 mr-2" />
        AI Analysis Debug Summary
      </CardTitle>
      <CardDescription className="text-yellow-600">
        This is a temporary display to troubleshoot AI detection
      </CardDescription>
    </>
  );
};

export default AIAnalysisHeader;
