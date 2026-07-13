import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Shield } from "lucide-react";

interface OpenAIConfigSectionProps {
  onConfigured?: () => void;
}

const OpenAIConfigSection: React.FC<OpenAIConfigSectionProps> = ({ onConfigured }) => {
  void onConfigured;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center">
          <Shield className="h-4 w-4 mr-2 text-amber-600" />
          Remote AI Disabled
        </CardTitle>
        <CardDescription>
          Phase 0 security cleanup is active for this copy of the application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Local-Only Processing</AlertTitle>
          <AlertDescription className="text-amber-700">
            Browser calls to external model providers are disabled. Upload, parsing, and local extraction
            continue to run while backend session APIs are being implemented.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default OpenAIConfigSection;
