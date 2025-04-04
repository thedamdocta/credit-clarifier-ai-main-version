
// This file contains utilities for processing and formatting address data
import { AddressInfo } from "@/lib/ai/contactInfoExtraction";

/**
 * Prepares address information for display
 * @param address The address information object
 * @returns Formatted address details
 */
export const prepareAddressForDisplay = (address: AddressInfo) => {
  // Extract city, state, and zip from the address string
  let city = "";
  let state = "";
  let zip = "";
  
  // Make sure address is a string before attempting to match
  if (typeof address.address === 'string') {
    // Try to extract city, state, zip using regex pattern for "CITY, ST ZIP" format
    const cityStateZipMatch = address.address.match(/([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
    
    if (cityStateZipMatch) {
      city = cityStateZipMatch[1].trim();
      state = cityStateZipMatch[2];
      zip = cityStateZipMatch[3];
    }
  }
  
  return {
    ...address,
    city,
    state,
    zip
  };
};

/**
 * Groups addresses by status (Current or Former)
 * @param addresses Array of address information
 * @returns Object with addresses grouped by status
 */
export const groupAddressesByStatus = (addresses: AddressInfo[]) => {
  const currentAddresses: AddressInfo[] = [];
  const formerAddresses: AddressInfo[] = [];
  
  addresses.forEach(address => {
    if (address.status.toLowerCase() === 'current') {
      currentAddresses.push(prepareAddressForDisplay(address));
    } else {
      formerAddresses.push(prepareAddressForDisplay(address));
    }
  });
  
  return {
    current: currentAddresses,
    former: formerAddresses
  };
};
