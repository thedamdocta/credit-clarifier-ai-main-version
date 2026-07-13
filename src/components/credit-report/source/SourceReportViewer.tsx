import React, { useEffect, useMemo, useState } from "react";
import { FileImage, Loader2, Maximize2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SourceReportViewerProps {
  sessionId?: string | null;
  pageNumbers?: number[];
  sourceSessionId?: string | null;
  pages?: number[];
  title?: string;
  description?: string;
}

interface SourcePageImageProps {
  sessionId: string;
  pageNumber: number;
}

const SourcePageImage: React.FC<SourcePageImageProps> = ({ sessionId, pageNumber }) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const imageUrl = `/api/sessions/${sessionId}/pages/${pageNumber}/image`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <FileImage className="h-4 w-4" />
          <span>Report Page {pageNumber}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8">
                <Maximize2 className="mr-2 h-3.5 w-3.5" />
                Full Size
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
              <DialogHeader className="border-b border-slate-200 px-6 py-4">
                <DialogTitle>Report Page {pageNumber}</DialogTitle>
                <DialogDescription>
                  Full-size source page for component verification.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(92vh-88px)] overflow-auto bg-slate-100 p-4 md:p-6">
                <img
                  src={imageUrl}
                  alt={`Full-size source report page ${pageNumber}`}
                  className="mx-auto h-auto max-w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                />
              </div>
            </DialogContent>
          </Dialog>

          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            Open image
          </a>
        </div>
      </div>

      <div className="bg-slate-50 p-3 md:p-4">
        <div className="relative flex min-h-[260px] items-center justify-center rounded-lg border border-slate-200 bg-white p-3 md:min-h-[320px] md:p-4">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading source page...</span>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 px-4 text-sm text-slate-500">
            <TriangleAlert className="h-4 w-4" />
            <span>Source page could not be loaded for this session.</span>
          </div>
        )}

        <img
          src={imageUrl}
          alt={`Source report page ${pageNumber}`}
          loading="lazy"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "h-auto max-h-[260px] w-auto max-w-full bg-white object-contain md:max-h-[360px]",
            status === "loaded" ? "block" : "invisible h-0"
          )}
        />
        </div>
      </div>
    </div>
  );
};

const SourceReportViewer: React.FC<SourceReportViewerProps> = ({
  sessionId,
  pageNumbers = [],
  sourceSessionId,
  pages = [],
  title = "Source Report Pages",
  description = "These are the report pages used for this extracted component. A page may appear in more than one component when it supports multiple extracted sections.",
}) => {
  const resolvedSessionId = sourceSessionId ?? sessionId;
  const resolvedPageNumbers = pageNumbers.length > 0 ? pageNumbers : pages;
  const initialBatchSize = 5;
  const uniquePages = useMemo(() => {
    const seen = new Set<number>();
    const pages: number[] = [];
    for (const entry of resolvedPageNumbers) {
      const page = Number(entry);
      if (!Number.isInteger(page) || page <= 0 || seen.has(page)) {
        continue;
      }
      seen.add(page);
      pages.push(page);
    }
    return pages;
  }, [resolvedPageNumbers]);
  const [visibleCount, setVisibleCount] = useState(initialBatchSize);

  useEffect(() => {
    setVisibleCount(initialBatchSize);
  }, [initialBatchSize, resolvedSessionId, uniquePages.length]);

  if (!resolvedSessionId || uniquePages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
        No source report pages are available for this component.
      </div>
    );
  }

  const visiblePages = uniquePages.slice(0, visibleCount);
  const hasMorePages = visibleCount < uniquePages.length;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:p-6">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
        <p className="text-xs text-slate-500">
          Showing {visiblePages.length} of {uniquePages.length} source pages.
        </p>
        <div className="flex flex-wrap gap-2">
          {uniquePages.map((pageNumber) => (
            <Badge key={pageNumber} variant="outline" className="rounded-full bg-white px-3 py-1 text-xs">
              Page {pageNumber}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visiblePages.map((pageNumber) => (
          <SourcePageImage key={pageNumber} sessionId={resolvedSessionId} pageNumber={pageNumber} />
        ))}
      </div>

      {hasMorePages ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((current) => Math.min(current + initialBatchSize, uniquePages.length))}
          >
            Load More Pages
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default SourceReportViewer;
