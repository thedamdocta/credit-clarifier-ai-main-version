
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Info, CheckCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canUseOpenAI } from "@/lib/ai/openai/openaiService";

interface OpenAIConfigSectionProps {
  onConfigured?: () => void;
}

const OpenAIConfigSection: React.FC<OpenAIConfigSectionProps> = ({ onConfigured }) => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  useEffect(() => {
    // Notify parent if OpenAI is already configured
    if (canUseOpenAI() && onConfigured) {
      onConfigured();
    }
  }, [onConfigured]);
  
  const handleSave = () => {
    if (apiKey && apiKey.trim() !== '') {
      localStorage.setItem('openai_api_key', apiKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (onConfigured) {
        onConfigured();
      }
    }
  };
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium flex items-center">
            <Shield className="h-4 w-4 mr-2 text-green-600" />
            AI-Powered Credit Table Extraction
            {canUseOpenAI() && (
              <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" /> Ready
              </Badge>
            )}
          </CardTitle>
        </div>
        <CardDescription>
          Enhanced table extraction powered by OpenAI
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canUseOpenAI() ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              AI-powered extraction is configured and ready to use. Your credit report tables will be processed automatically.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert className="mb-4 bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Configuration Required</AlertTitle>
              <AlertDescription className="text-amber-700">
                For best results, please provide your OpenAI API key before uploading your credit report.
              </AlertDescription>
            </Alert>
            <div className="text-sm mb-3">
              <p>The app has a built-in OpenAI API key, but you can provide your own for better reliability.</p>
            </div>
            <div className="flex gap-2">
              <Input 
                type={showApiKey ? "text" : "password"} 
                className="flex h-9 w-full"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..." 
              />
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? "Hide" : "Show"}
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={handleSave}
              >
                Save Key
              </Button>
            </div>
            {saved && <p className="text-green-600 text-xs mt-1">API key saved!</p>}
          </>
        )}
        
        <div className="flex items-center mt-3 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mr-1" />
          <span>Your credit report data is processed locally in your browser</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default OpenAIConfigSection;
