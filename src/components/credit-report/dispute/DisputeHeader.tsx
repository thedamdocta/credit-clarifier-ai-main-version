
import React from "react";
import { CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

const DisputeHeader: React.FC = () => {
  return (
    <CardTitle className="text-sm flex items-center">
      <CalendarDays className="h-4 w-4 mr-2" />
      Dispute Information
    </CardTitle>
  );
};

export default DisputeHeader;
