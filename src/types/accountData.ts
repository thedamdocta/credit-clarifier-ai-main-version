
/**
 * Type definitions for credit account data
 */

export interface AccountData {
  accountType: string;
  open: string;
  withBalance: string;
  totalBalance: string;
  available: string;
  creditLimit: string;
  debtToCredit: string;
  payment: string;
}

export interface TableExtractionResult {
  data: AccountData[];
  confidence: number;
  imageUrl: string;
}
