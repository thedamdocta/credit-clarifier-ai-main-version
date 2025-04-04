
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { parsingLogger } from "@/utils/parsingLogger";
import { Bug, Code, Table } from "lucide-react";
import CreditAccounts from "@/components/credit-report/CreditAccounts";
import { CreditReport } from "@/lib/types/creditReport";
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ParsingDebuggerProps {
  isVisible?: boolean;
}

const ParsingDebugger = ({ isVisible = false }: ParsingDebuggerProps) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(isVisible);
  const [debugReport, setDebugReport] = useState<CreditReport | null>(null);
  
  useEffect(() => {
    // Update logs every second while parsing is in progress
    const intervalId = setInterval(() => {
      const currentLogs = parsingLogger.getLogs();
      if (currentLogs.length > 0) {
        setLogs([...currentLogs]);
        setSummary(parsingLogger.getSummary());
        
        // Try to extract a report from the logs to display account summaries
        const reportLog = currentLogs.find(log => log.report);
        if (reportLog && reportLog.report) {
          setDebugReport(reportLog.report);
        }
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Format value function for account summary table cells
  const formatValue = (value: string | number | undefined | null) => {
    // Return empty string for null/undefined values
    if (value === undefined || value === null || value === '') {
      return ""; 
    }
    
    // Convert value to string
    const stringValue = String(value);
    
    // For values already properly formatted with $ or -$, return as is
    if (typeof stringValue === 'string' && (stringValue.startsWith('$') || stringValue.startsWith('-$'))) {
      return stringValue;
    }
    
    // For numerical values or numeric strings that should be dollar amounts
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value.replace(/[^0-9.-]/g, ''))))) {
      let numericValue: number;
      
      if (typeof value === 'number') {
        numericValue = value;
      } else {
        // Extract numeric value from string, preserving negative sign
        const cleanedValue = value.replace(/[^0-9.-]/g, '');
        numericValue = parseFloat(cleanedValue);
      }
      
      // Format according to sign
      return numericValue < 0 ? 
        `-$${Math.abs(numericValue).toLocaleString()}` : 
        `$${numericValue.toLocaleString()}`;
    }
    
    return value; // Return as is if it's not a numeric value
  };

  // Utility function to check if a cell value exists
  const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value !== '';
  };
  
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
          <TabsTrigger value="accounts" className="flex items-center">
            <Table className="h-4 w-4 mr-2" />
            Account Table
          </TabsTrigger>
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
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Successful</Badge>
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
        
        <TabsContent value="accounts">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-2">
              Account Summary Table (8x5) - Cell by Cell Extraction
            </div>
            {debugReport && debugReport.accountSummaries && debugReport.accountSummaries.length > 0 ? (
              <div className="border rounded-md overflow-x-auto">
                <UITable>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead>Account Type</TableHead>
                      <TableHead>Open</TableHead>
                      <TableHead>With Balance</TableHead>
                      <TableHead>Total Balance</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Credit Limit</TableHead>
                      <TableHead>Debt-to-Credit</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debugReport.accountSummaries.map((summary, index) => (
                      <TableRow 
                        key={`debug-account-${index}`} 
                        className={summary.accountType === 'Total' ? 'bg-muted/30 font-semibold' : ''}
                      >
                        <TableCell className="font-medium">{summary.accountType}</TableCell>
                        <TableCell>{hasValue(summary.open) ? summary.open : ""}</TableCell>
                        <TableCell>{hasValue(summary.withBalance) ? summary.withBalance : ""}</TableCell>
                        <TableCell>{hasValue(summary.totalBalance) ? formatValue(summary.totalBalance) : ""}</TableCell>
                        <TableCell>{hasValue(summary.available) ? formatValue(summary.available) : ""}</TableCell>
                        <TableCell>{hasValue(summary.creditLimit) ? formatValue(summary.creditLimit) : ""}</TableCell>
                        <TableCell>{hasValue(summary.debtToCredit) ? summary.debtToCredit : ""}</TableCell>
                        <TableCell>{hasValue(summary.payment) ? formatValue(summary.payment) : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </UITable>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No account summary data available yet
              </div>
            )}
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
