
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, MapPin, Hash, CalendarDays, Briefcase, ShieldAlert } from "lucide-react";
import { PersonalInfo } from "@/lib/creditReportParser";
import { isNotReportedValue } from "@/utils/formatters/accountValueFormatters";

interface PersonalInfoCardProps {
  personalInfo: PersonalInfo;
  embedded?: boolean;
}

const PersonalInfoCard: React.FC<PersonalInfoCardProps> = ({ personalInfo, embedded = false }) => {
  // Filter and clean up addresses
  const formattedAddresses = personalInfo.addresses
    .filter((addr) => !isNotReportedValue(addr))
    .map((addr) => addr.trim());
  const formattedCurrentAddresses = (personalInfo.currentAddresses || [])
    .filter((addr) => !isNotReportedValue(addr))
    .map((addr) => addr.trim());
  const formattedPreviousAddresses = (personalInfo.previousAddresses || [])
    .filter((addr) => !isNotReportedValue(addr))
    .map((addr) => addr.trim());
  
  // Handle additional information that might be stored in address fields
  const optOutInfo = personalInfo.addresses.find(addr => 
    addr.toLowerCase().includes("opt out")
  );
  
  // Extract employment info from addresses or use specific field if available
  const employmentLines = (personalInfo.employmentHistory || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

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

  if (embedded) {
    const currentAddresses = formattedCurrentAddresses;
    const previousAddresses = formattedPreviousAddresses;
    const additionalAddresses = formattedAddresses.filter(
      (address) => !currentAddresses.includes(address) && !previousAddresses.includes(address)
    );
    const rowValueClass = (value?: string) =>
      [
        "text-sm whitespace-pre-line break-words",
        "text-left",
        isNotReportedValue(value || "Not reported") ? "text-slate-400" : "text-foreground",
      ].join(" ");

    const Row = ({
      label,
      children,
      noBorder = false,
    }: {
      label: string;
      children: React.ReactNode;
      noBorder?: boolean;
    }) => (
      <div className={`grid grid-cols-[220px_minmax(0,1fr)] gap-6 ${noBorder ? "" : "border-b pb-3"}`}>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="min-w-0">{children}</div>
      </div>
    );

    return (
      <CardContent className="pt-4">
        <div className="space-y-4">
          <Row label="Full Name">
            <span className={rowValueClass(displayName)}>{displayName || "Not reported"}</span>
          </Row>

          <Row label="Social Security Number">
            <span className={rowValueClass(extractedSSN)}>{extractedSSN || "Not reported"}</span>
          </Row>

          <Row label="Date of Birth">
            <span className={rowValueClass(personalInfo.dob)}>{personalInfo.dob || "Not reported"}</span>
          </Row>

          <Row label="Current Addresses">
            <div className="space-y-2">
              {currentAddresses.length > 0 ? (
                currentAddresses.map((address, index) => (
                  <p key={`current-${address}-${index}`} className="text-sm leading-6 break-words">
                    {address}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-400">Not reported</p>
              )}
            </div>
          </Row>

          <Row label="Previous Addresses">
            <div className="space-y-2">
              {previousAddresses.length > 0 ? (
                previousAddresses.map((address, index) => (
                  <p key={`previous-${address}-${index}`} className="text-sm leading-6 break-words">
                    {address}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-400">Not reported</p>
              )}
            </div>
          </Row>

          {additionalAddresses.length > 0 && (
            <Row label="Other Addresses">
              <div className="space-y-2">
                {additionalAddresses.map((address, index) => (
                  <p key={`other-${address}-${index}`} className="text-sm leading-6 break-words">
                    {address}
                  </p>
                ))}
              </div>
            </Row>
          )}

          <Row label="Employment History">
            <div className="space-y-2">
              {employmentLines.length > 0 ? (
                employmentLines.map((entry, index) => (
                  <p key={`employment-${entry}-${index}`} className="text-sm leading-6 break-words">
                    {entry}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-400">Not reported</p>
              )}
            </div>
          </Row>

          {optOutInfo && (
            <Row label="Opt-Out Information" noBorder>
              <span className={rowValueClass(optOutInfo)}>{optOutInfo}</span>
            </Row>
          )}
        </div>
      </CardContent>
    );
  }

  const content = (
    <>
      {!embedded && (
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="mr-2 h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>Personal details from your credit report</CardDescription>
        </CardHeader>
      )}
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
            <p className="text-sm font-medium leading-none">{employmentLines.join(", ") || "Not reported"}</p>
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
    </>
  );

  if (embedded) {
    return content;
  }

  return <Card>{content}</Card>;
};

export default PersonalInfoCard;
