import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditReport, Inquiry } from "@/lib/types/creditReport";
import { isNotReportedValue } from "@/utils/formatters/accountValueFormatters";
import ExtractedSourceTabs from "../source/ExtractedSourceTabs";

interface InquiriesComponentProps {
  report: CreditReport;
}

const InquiryTable: React.FC<{ title: string; inquiries: Inquiry[]; className?: string }> = ({ title, inquiries, className }) => {
  return (
    <div className={className ?? "space-y-3"}>
      <h4 className="font-semibold text-sm">{title}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subscriber</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Reference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquiries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No entries extracted
              </TableCell>
            </TableRow>
          ) : (
            inquiries.map((inquiry, index) => (
              <TableRow key={`${title}-${index}`}>
                {[
                  inquiry.subscriberName || "Not reported",
                  inquiry.inquiryDate || "Not reported",
                  inquiry.purpose || "Not reported",
                  inquiry.referenceNumber || "Not reported",
                ].map((value, cellIndex) => (
                  <TableCell key={`${title}-${index}-${cellIndex}`} className={isNotReportedValue(value) ? "text-slate-400" : undefined}>
                    {value}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const InquiriesComponent: React.FC<InquiriesComponentProps> = ({ report }) => {
  const hardInquiries = report.inquiryBuckets?.hardInquiries || [];
  const softInquiries = report.inquiryBuckets?.softInquiries || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inquiries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ExtractedSourceTabs
          sessionId={report.sourceSessionId}
          pageNumbers={report.sourceComponents?.inquiries?.pages}
          sourceTitle="Inquiries Source Pages"
          sourceDescription="These report pages support the extracted hard and soft inquiry sections. Some pages may also support other components."
          tabsClassName="mb-4"
        >
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              Hard and soft inquiries extracted from the Equifax report.
            </p>
            <InquiryTable title="Hard Inquiries" inquiries={hardInquiries} className="space-y-4" />
            <div className="my-6 border-t border-slate-200" aria-hidden="true" />
            <InquiryTable title="Soft Inquiries" inquiries={softInquiries} className="space-y-4 pt-2" />
          </>
        </ExtractedSourceTabs>
      </CardContent>
    </Card>
  );
};

export default InquiriesComponent;
