
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, MapPin, Hash, CalendarDays } from "lucide-react";
import { PersonalInfo } from "@/lib/creditReportParser";

interface PersonalInfoCardProps {
  personalInfo: PersonalInfo;
}

const PersonalInfoCard: React.FC<PersonalInfoCardProps> = ({ personalInfo }) => {
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
            <p className="text-sm font-medium leading-none">{personalInfo.name}</p>
            <p className="text-sm text-muted-foreground">Full Name</p>
          </div>
        </div>
        
        {personalInfo.addresses.map((address, index) => (
          <div key={index} className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{address}</p>
              <p className="text-sm text-muted-foreground">Address {personalInfo.addresses.length > 1 ? index + 1 : ''}</p>
            </div>
          </div>
        ))}
        
        {personalInfo.ssn && (
          <div className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{personalInfo.ssn}</p>
              <p className="text-sm text-muted-foreground">Social Security Number</p>
            </div>
          </div>
        )}
        
        {personalInfo.dob && (
          <div className="grid grid-cols-[25px_1fr] items-start pb-2 last:mb-0 last:pb-0">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">{personalInfo.dob}</p>
              <p className="text-sm text-muted-foreground">Date of Birth</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PersonalInfoCard;
