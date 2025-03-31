
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Link2, SendHorizontal, RefreshCw, Webhook, Check, Copy } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CreditReport } from "@/lib/creditReportParser";

interface WebhookManagerProps {
  creditReport: CreditReport | null;
  isProcessing: boolean;
}

const WebhookManager: React.FC<WebhookManagerProps> = ({ creditReport, isProcessing }) => {
  const [inboundWebhookUrl, setInboundWebhookUrl] = useState<string>("");
  const [outboundWebhookUrl, setOutboundWebhookUrl] = useState<string>("");
  const [autoSend, setAutoSend] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  const generateWebhookUrl = () => {
    // In a real app, this would generate a unique URL on your backend
    // For demo purposes, we're just creating a random string
    const randomId = Math.random().toString(36).substring(2, 15);
    return `https://credit-clarifier.ai/api/webhook/${randomId}`;
  };

  const handleGenerateInboundWebhook = () => {
    setInboundWebhookUrl(generateWebhookUrl());
    toast.success("Inbound webhook URL generated!");
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success("Copied to clipboard!");
      },
      () => {
        toast.error("Failed to copy text");
      }
    );
  };

  const handleSendWebhook = async () => {
    if (!creditReport) {
      toast.error("No credit report data to send!");
      return;
    }

    if (!outboundWebhookUrl) {
      toast.error("Please enter an outbound webhook URL");
      return;
    }

    setIsSending(true);

    try {
      // In a real app, this would be a secure call to your backend
      // which would then forward the data to the webhook URL
      console.log("Sending data to webhook:", outboundWebhookUrl);
      console.log("Credit report data:", creditReport);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast.success("Data sent to webhook successfully!");
    } catch (error) {
      console.error("Error sending webhook:", error);
      toast.error("Failed to send data to webhook");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Webhook className="mr-2 h-5 w-5" />
            Inbound Webhook
          </CardTitle>
          <CardDescription>
            Allow external services to send credit reports to this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              value={inboundWebhookUrl}
              readOnly
              placeholder="Generate a webhook URL"
              className="flex-1"
            />
            <Button
              onClick={() => handleCopyToClipboard(inboundWebhookUrl)}
              variant="outline"
              size="icon"
              disabled={!inboundWebhookUrl}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleGenerateInboundWebhook}>
            <Link2 className="mr-2 h-4 w-4" />
            Generate URL
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SendHorizontal className="mr-2 h-5 w-5" />
            Outbound Webhook
          </CardTitle>
          <CardDescription>
            Send processed credit report data to external services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={outboundWebhookUrl}
              onChange={(e) => setOutboundWebhookUrl(e.target.value)}
              placeholder="https://your-service.com/webhook"
              className="flex-1"
            />
            <p className="text-sm text-muted-foreground">
              Enter the URL where processed credit report data should be sent
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auto-send"
              checked={autoSend}
              onCheckedChange={setAutoSend}
            />
            <Label htmlFor="auto-send">Automatically send data when a new report is processed</Label>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSendWebhook} 
            disabled={isSending || !outboundWebhookUrl || !creditReport}
          >
            {isSending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <SendHorizontal className="mr-2 h-4 w-4" />
                Send Data Now
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default WebhookManager;
