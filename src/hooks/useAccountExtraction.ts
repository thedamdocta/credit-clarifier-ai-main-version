import { useEffect, useState, useCallback } from "react";
import { Account, CreditReport } from "@/lib/types/creditReport";
import { extractAccountsFromReport } from "@/lib/ai/accountsExtraction";

interface UseAccountExtractionResult {
  accounts: Account[];
  isProcessing: boolean;
  error: string | null;
  logs: any[];
  refetch: () => void;
}

const hasEnhancedAccountData = (accounts: Account[] | undefined): boolean => {
  if (!accounts || accounts.length === 0) return false;
  const first = accounts[0];
  return Array.isArray(first.balanceHistory) && first.balanceHistory.length > 0;
};

export const useAccountExtraction = (report: CreditReport | null): UseAccountExtractionResult => {
  const [accounts, setAccounts] = useState<Account[]>(report?.accounts ?? []);
  const [logs, setLogs] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refetch = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!report || !report.rawText) {
      setAccounts(report?.accounts ?? []);
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (hasEnhancedAccountData(report.accounts) && refreshIndex === 0) {
        setAccounts(report.accounts ?? []);
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const { accounts: extractedAccounts, logs: extractionLogs } = await extractAccountsFromReport(report);

        if (cancelled) {
          return;
        }

        setAccounts(extractedAccounts);
        setLogs(extractionLogs);

        // Mutate the report object so downstream consumers (webhooks, etc.) receive the enhanced data.
        report.accounts = extractedAccounts;
      } catch (exception) {
        if (cancelled) {
          return;
        }
        const message = exception instanceof Error ? exception.message : String(exception);
        setError(message);
      } finally {
        if (!cancelled) {
          setIsProcessing(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [report, report?.reportId, report?.rawText, refreshIndex]);

  return {
    accounts,
    isProcessing,
    error,
    logs,
    refetch
  };
};

export default useAccountExtraction;
