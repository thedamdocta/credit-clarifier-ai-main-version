
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { parsingLogger } from "@/utils/parsingLogger";
import { Bug, Code } from "lucide-react";

interface ParsingDebuggerProps {
  isVisible?: boolean;
}

const ParsingDebugger = ({ isVisible = false }: ParsingDebuggerProps) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(isVisible);
  
  useEffect(() => {
    // Update logs every second while parsing is in progress
    const intervalId = setInterval(() => {
      const currentLogs = parsingLogger.getLogs();
      if (currentLogs.length > 0) {
        setLogs([...currentLogs]);
        setSummary(parsingLogger.getSummary());
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 opacity-70 hover:opacity-100"
        onClick={() => setIsOpen(true)}
      >
        <Bug className="h-4 w-4 mr-2" />
        Debug Parser
      </Button>
    );
  }
  
  return (
    <Card className="fixed bottom-4 right-4 w-[600px] max-h-[80vh] overflow-y-auto z-50 shadow-lg">
      <CardHeader className="bg-muted/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-md flex items-center">
            <Bug className="h-5 w-5 mr-2" /> Parsing Debugger
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            ×
          </Button>
        </div>
        <CardDescription>
          Monitor the credit report parsing process in real-time
        </CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="summary">
        <TabsList className="w-full">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="logs">Raw Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary">
          <CardContent className="space-y-4 pt-4">
            {summary ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted p-2 rounded-md">
                    <div className="text-xs text-muted-foreground">Report ID</div>
                    <div>{summary.reportId}</div>
                  </div>
                  <div className="bg-muted p-2 rounded-md">
                    <div className="text-xs text-muted-foreground">Bureau</div>
                    <div>{summary.bureau || "Unknown"}</div>
                  </div>
                  <div className="bg-muted p-2 rounded-md">
                    <div className="text-xs text-muted-foreground">Text Length</div>
                    <div>{summary.textLength} chars</div>
                  </div>
                  <div className="bg-muted p-2 rounded-md">
                    <div className="text-xs text-muted-foreground">Duration</div>
                    <div>{(summary.durationMs / 1000).toFixed(2)}s</div>
                  </div>
                </div>
                
                <div className="p-2 rounded-md border">
                  <div className="text-xs text-muted-foreground mb-2">Status</div>
                  {summary.errors > 0 ? (
                    <Badge variant="destructive">{summary.errors} Error(s)</Badge>
                  ) : (
                    <Badge variant="success">Successful</Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-4 text-muted-foreground">
                No parsing data available
              </div>
            )}
          </CardContent>
        </TabsContent>
        
        <TabsContent value="timeline">
          <CardContent className="pt-4">
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start space-x-2 text-sm border-l-2 pl-4 py-1 border-muted">
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium">{log.stage}</span>
                    {log.stage === 'error' ? (
                      <div className="text-destructive mt-1">{log.error}</div>
                    ) : log.success === false ? (
                      <Badge variant="destructive" className="ml-2">Failed</Badge>
                    ) : log.success === true ? (
                      <Badge variant="outline" className="ml-2">Success</Badge>
                    ) : null}
                    
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {Object.entries(log.details)
                          .filter(([key]) => key !== 'error')
                          .map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}: </span>
                              {String(value)}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {logs.length === 0 && (
                <div className="text-center p-4 text-muted-foreground">
                  No parsing events logged yet
                </div>
              )}
            </div>
          </CardContent>
        </TabsContent>
        
        <TabsContent value="logs">
          <CardContent className="pt-4">
            <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
              {JSON.stringify(logs, null, 2)}
            </pre>
          </CardContent>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="bg-muted/50 justify-between">
        <Button variant="outline" size="sm" onClick={() => setLogs([])}>
          Clear
        </Button>
        <div className="text-xs text-muted-foreground">
          {logs.length} events logged
        </div>
      </CardFooter>
    </Card>
  );
};

export default ParsingDebugger;
