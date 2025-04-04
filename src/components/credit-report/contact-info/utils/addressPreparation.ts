
import { CreditReport } from "@/lib/types/creditReport";
import { AddressInfo } from "@/lib/ai/contactInfoExtraction";

/**
 * Format address by removing status and date prefixes
 */
export const formatAddress = (address: string | null): string => {
  if (!address) return "";
  
  return address.replace(/^(current|former)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}\s+/i, '');
};

/**
 * Prepare addresses from the credit report for display
 */
export const prepareAddresses = (report: CreditReport): AddressInfo[] => {
  if (!report.personalInfo || !report.personalInfo.addresses) {
    return [];
  }

  return report.personalInfo.addresses.map((address, index) => {
    const isAddressObj = typeof address === 'object' && address !== null && 'address' in address;
    
    if (isAddressObj) {
      const addressObj = address as any;
      return {
        address: formatAddress(addressObj.address),
        status: addressObj.status || 'Unknown',
        dateReported: addressObj.dateReported || ''
      };
    } else {
      let status = 'Unknown';
      let dateReported = '';
      
      if (typeof address === 'string') {
        if (address.toLowerCase().includes('current')) {
          status = 'Current';
        } else if (address.toLowerCase().includes('former')) {
          status = 'Former';
        }
        
        // Fix: Add null check before calling match on address
        const dateMatch = typeof address === 'string' ? address.match(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}/i) : null;
          
        if (dateMatch) {
          dateReported = dateMatch[0];
        }
      }
      
      return {
        address: typeof address === 'string' ? formatAddress(address) : '',
        status,
        dateReported
      };
    }
  });
};
