
import React, { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface LogEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ExtractionProcessLogProps {
  isVisible: boolean;
}

const ExtractionProcessLog: React.FC<ExtractionProcessLogProps> = ({ isVisible }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (isVisible && !isSubscribed) {
      setIsSubscribed(true);
      
      // Add initial logs
      setLogs([
        { 
          message: "Starting extraction process...", 
          timestamp: new Date(), 
          type: 'info' 
        }
      ]);
      
      // Setup a listener for console messages to capture processing events
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      
      const logCapture = (message: any, type: 'info' | 'success' | 'error' | 'warning') => {
        if (typeof message === 'string') {
          setLogs(prevLogs => [
            ...prevLogs, 
            { 
              message: String(message), 
              timestamp: new Date(), 
              type 
            }
          ].slice(-100)); // Keep only the last 100 logs for performance
        }
      };
      
      console.log = (...args) => {
        originalConsoleLog(...args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // Filter only relevant extraction messages to avoid overwhelming the user
        if (message.includes('extract') || 
            message.includes('process') || 
            message.includes('table') || 
            message.includes('account') || 
            message.includes('PDF') ||
            message.includes('image')) {
          logCapture(message, 'info');
        }
      };
      
      console.error = (...args) => {
        originalConsoleError(...args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        logCapture(`Error: ${message}`, 'error');
      };
      
      console.warn = (...args) => {
        originalConsoleWarn(...args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        logCapture(`Warning: ${message}`, 'warning');
      };
      
      // Events we know should trigger success messages
      const successEvents = [
        'Successfully extracted image',
        'Identified bureau',
        'Successfully extracted',
        'Table detected',
        'Found account summaries',
        'text extraction complete'
      ];
      
      // Check regularly for success events
      const checkSuccessInterval = setInterval(() => {
        setLogs(prevLogs => {
          const lastLog = prevLogs[prevLogs.length - 1];
          if (lastLog && successEvents.some(event => lastLog.message.includes(event))) {
            return [
              ...prevLogs,
              {
                message: `✓ ${lastLog.message.substring(0, 50)}... completed`,
                timestamp: new Date(),
                type: 'success'
              }
            ];
          }
          return prevLogs;
        });
      }, 1500);
      
      return () => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        clearInterval(checkSuccessInterval);
        setIsSubscribed(false);
      };
    }
  }, [isVisible, isSubscribed]);

  if (!isVisible) return null;

  return (
    <div className="border rounded-md p-2 bg-black/5 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Real-time Extraction Process</h3>
        <Badge variant="outline" className="text-xs">
          {logs.length} events
        </Badge>
      </div>
      <ScrollArea className="h-[200px] w-full rounded border p-2 bg-black/10">
        <div className="space-y-1">
          {logs.map((log, index) => (
            <div 
              key={index} 
              className={`text-xs py-1 border-l-2 pl-2 ${
                log.type === 'error' ? 'border-red-500 text-red-600' :
                log.type === 'success' ? 'border-green-500 text-green-600' :
                log.type === 'warning' ? 'border-yellow-500 text-yellow-600' :
                'border-blue-500'
              }`}
            >
              <span className="text-slate-500 mr-2">
                {log.timestamp.toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExtractionProcessLog;
