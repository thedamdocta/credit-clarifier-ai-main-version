
import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import DisputeHeader from "./dispute/DisputeHeader";
import DisputeContent from "./dispute/DisputeContent";

const DisputeInformation: React.FC = () => {
  return (
    <Card>
      <CardHeader className="bg-gray-50">
        <DisputeHeader />
      </CardHeader>
      <DisputeContent />
    </Card>
  );
};

export default DisputeInformation;
