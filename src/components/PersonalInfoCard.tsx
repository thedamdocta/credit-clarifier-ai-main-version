
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, MapPin, Hash, CalendarDays, Briefcase, ShieldAlert } from "lucide-react";
import { PersonalInfo } from "@/lib/creditReportParser";

interface PersonalInfoCardProps {
  personalInfo: PersonalInfo;
}

// Helper function to format long address strings
const formatAddress = (address: string): string => {
  // Clean up the address - remove any "reported to" prefixes or other non-address text
  let cleanAddress = address;
  
  if (address.toLowerCase().includes("reported to")) {
    // Extract just the address portion after context
    const addressParts = address.split("Current ");
    if (addressParts.length > 1) {
      cleanAddress = "Current " + addressParts[1];
    }
  }
  
  // Format address to be more readable by adding line breaks at appropriate points
  return cleanAddress
    .replace(/(\d{5})(\s+Former|\s+Current)/g, "$1\n$2") // Add line break before Former/Current
    .replace(/(\d{5})$/g, "$1"); // End with zip code
};

// Helper to determine if a string is primarily an address
const isAddressString = (str: string): boolean => {
  // Check if string contains common address indicators
  return /\d+\s+[A-Za-z]+\s+(?:ST|AVE|BLVD|RD|DR|LN|CT|APT)/i.test(str);
};

const PersonalInfoCard: React.FC<PersonalInfoCardProps> = ({ personalInfo }) => {
  // Filter and clean up addresses
  const formattedAddresses = personalInfo.addresses
    .filter(addr => addr !== 'Not Found' && isAddressString(addr))
    .map(formatAddress);
  
  // Handle additional information that might be stored in address fields
  const optOutInfo = personalInfo.addresses.find(addr => 
    addr.toLowerCase().includes("opt out")
  );
  
  // Extract employment info from addresses or use specific field if available
  const employmentInfo = personalInfo.employmentHistory || 
                        personalInfo.addresses.find(addr => 
                          addr.toLowerCase().includes("employer") || 
                          addr.toLowerCase().includes("employment")
                        ) || 
                        "Employment history not available";

  // Check if SSN and DOB exist in the personal info
  const hasSSN = personalInfo.ssn && personalInfo.ssn !== undefined;
  const hasDOB = personalInfo.dob && personalInfo.dob !== undefined;

  // If name includes SSN, extract it - sometimes SSN is embedded in the name field
  let displayName = personalInfo.name;
  let extractedSSN = personalInfo.ssn;
  
  if (displayName.toLowerCase().includes("social security") || 
      displayName.toLowerCase().includes("ssn")) {
    // Try to extract the SSN from the name string if it's there
    const ssnMatch = displayName.match(/(.*?)(?:Social Security Number|SSN):?\s*([\dX]{3}-[\dX]{2}-[\dX]{4}|XXX-XX-\d{4})/i);
    if (ssnMatch) {
      displayName = ssnMatch[1].trim();
      extractedSSN = extractedSSN || ssnMatch[2];
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="mr-2 h-5 w-5" />
          Personal Information
        </CardTitle>
        <CardDescription>Personal details from your credit report</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
          <User className="h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-sm text-muted-foreground">Full Name</p>
          </div>
        </div>
        
        {extractedSSN && (
          <div className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{extractedSSN}</p>
              <p className="text-sm text-muted-foreground">Social Security Number</p>
            </div>
          </div>
        )}
        
        {hasDOB && (
          <div className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{personalInfo.dob}</p>
              <p className="text-sm text-muted-foreground">Date of Birth</p>
            </div>
          </div>
        )}
        
        {formattedAddresses.map((address, index) => (
          <div key={index} className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none whitespace-pre-line">{address}</p>
              <p className="text-sm text-muted-foreground">
                {`Address ${index + 1}`}
              </p>
            </div>
          </div>
        ))}
        
        <div className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
          <Briefcase className="h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">{employmentInfo}</p>
            <p className="text-sm text-muted-foreground">Employment History</p>
          </div>
        </div>
        
        {optOutInfo && (
          <div className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{optOutInfo}</p>
              <p className="text-sm text-muted-foreground">Opt-Out Information</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PersonalInfoCard;
