
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { parsingLogger } from "@/utils/parsingLogger";
import { Bug, Code, Table, Image } from "lucide-react";
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditReport } from "@/lib/types/creditReport";

interface ParsingDebuggerProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const ParsingDebugger = ({ isVisible = false, onClose }: ParsingDebuggerProps) => {
  const [events, setEvents] = useState<any[]>([]);
  const [activeReport, setActiveReport] = useState<CreditReport | null>(null);
  const [activeTab, setActiveTab] = useState("events");

  // Load parsing events on mount
  useEffect(() => {
    if (isVisible) {
      // Get parsing events using the getEvents method
      setEvents(parsingLogger.getEvents());
      
      // Get current report if available
      try {
        const reportData = localStorage.getItem('currentReport');
        if (reportData) {
          setActiveReport(JSON.parse(reportData));
        }
      } catch (e) {
        console.error("Error loading report data:", e);
      }
    }
  }, [isVisible]);
  
  if (!isVisible) return null;

  return (
    <Card className="fixed bottom-4 right-4 max-w-3xl w-full h-[500px] overflow-hidden z-50 shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Bug className="h-5 w-5 mr-2" />
            <CardTitle className="text-lg">Parsing Debugger</CardTitle>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          )}
        </div>
        <CardDescription>
          Monitor credit report parsing process
        </CardDescription>
        
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="events">
              <Code className="h-4 w-4 mr-2" />
              Events Log
            </TabsTrigger>
            <TabsTrigger value="data">
              <Table className="h-4 w-4 mr-2" />
              Data View
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent className="h-[360px] overflow-y-auto pb-0">
        <TabsContent value="events" className="m-0">
          {events.length === 0 ? (
            <div className="text-center p-4 text-muted-foreground">
              No parsing events recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event, i) => (
                <div key={i} className="text-xs border rounded p-2">
                  <div className="flex justify-between mb-1">
                    <Badge variant="outline">{event.type}</Badge>
                    <span className="text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div>{event.message}</div>
                  {event.data && (
                    <pre className="text-xs bg-muted p-1 mt-1 overflow-x-auto">
                      {typeof event.data === 'object' ? JSON.stringify(event.data, null, 2) : event.data}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="data" className="m-0">
          {!activeReport ? (
            <div className="text-center p-4 text-muted-foreground">
              No report data available.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Report Overview</h3>
                <UITable>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Bureau</TableCell>
                      <TableCell>{activeReport.bureau}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Report Date</TableCell>
                      <TableCell>{activeReport.reportDate}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Accounts</TableCell>
                      <TableCell>{activeReport.accounts?.length || 0}</TableCell>
                    </TableRow>
                  </TableBody>
                </UITable>
              </div>
              
              <div>
                <h3 className="font-medium mb-1">Accounts</h3>
                {activeReport.accounts?.length > 0 ? (
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeReport.accounts.slice(0, 5).map((account, i) => (
                        <TableRow key={i}>
                          <TableCell>{account.accountName}</TableCell>
                          <TableCell>{account.accountType}</TableCell>
                          <TableCell>{account.status}</TableCell>
                        </TableRow>
                      ))}
                      {activeReport.accounts.length > 5 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            + {activeReport.accounts.length - 5} more accounts
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </UITable>
                ) : (
                  <div className="text-center p-2 text-muted-foreground border rounded">
                    No accounts data available
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2">
        <div className="text-xs text-muted-foreground">
          {events.length} events logged
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => parsingLogger.clearEvents()}
        >
          Clear Logs
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ParsingDebugger;
