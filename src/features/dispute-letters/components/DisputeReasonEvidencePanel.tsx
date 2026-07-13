import React from "react";
import { ExternalLink, FileImage, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  DisputeEvidenceSlide,
  DisputeLetterDraft,
  DisputeReason,
  DisputeReasonEvidenceBundle,
} from "../types";

const HIGHLIGHT_YELLOW = "rgba(255, 235, 59, 0.42)";

const highlightBoxStyle = {
  backgroundColor: HIGHLIGHT_YELLOW,
  borderColor: HIGHLIGHT_YELLOW,
};

const buildHighlightedCropImageUrl = (sessionId: string, slide: DisputeEvidenceSlide) => {
  const encodedSlide = encodeURIComponent(
    JSON.stringify({
      pageNumber: slide.pageNumber,
      pageImageWidth: slide.pageImageWidth,
      pageImageHeight: slide.pageImageHeight,
      cropBox: slide.cropBox,
      highlightBoxes: slide.highlightBoxes,
    }),
  );
  return `/api/evidence/slide-image?sessionId=${encodeURIComponent(sessionId)}&slide=${encodedSlide}`;
};

const buildCompactPreviewDimensions = (slide: DisputeEvidenceSlide) => {
  const cropWidth = Math.max(Number(slide.cropBox.width) || 1, 1);
  const cropHeight = Math.max(Number(slide.cropBox.height) || 1, 1);
  const cropAspectRatio = cropWidth / cropHeight;
  const isWideStripCrop = cropAspectRatio >= 3.2;
  const maxWidth = isWideStripCrop ? 460 : 300;
  const maxHeight = isWideStripCrop ? 160 : 170;
  const minWidth = isWideStripCrop ? 340 : 220;
  const minHeight = isWideStripCrop ? 0 : 118;
  const maxScale = isWideStripCrop ? 2.1 : 1.35;
  const maxScaleFromBounds = Math.min(maxWidth / cropWidth, maxHeight / cropHeight, maxScale);
  const minScaleFromBounds = Math.max(minWidth / cropWidth, minHeight / cropHeight);
  const preferredScale = minScaleFromBounds <= maxScaleFromBounds ? maxScaleFromBounds : Math.min(maxScale, maxWidth / cropWidth);
  return {
    width: Math.round(cropWidth * preferredScale),
    height: Math.round(cropHeight * preferredScale),
  };
};

export const humanizeEntityType = (value: string) => value.replace(/_/g, " ");
export const formatPageList = (pages: number[]) => (pages.length ? pages.join(", ") : "Not available");

export const reasonEntityLabel = (reason: DisputeReason) => {
  if (reason.entityType === "account") {
    return reason.entityKey.split("::")[0].toUpperCase();
  }
  return humanizeEntityType(reason.entityType).toUpperCase();
};

const HighlightBoxes = ({
  slide,
  className,
}: {
  slide: DisputeEvidenceSlide;
  className?: string;
}) => (
  <>
    {slide.highlightBoxes.map((box, index) => (
      <div
        key={`${slide.id}-highlight-${index}`}
        className={cn("absolute border-2", className)}
        style={{
          left: `${(box.x / slide.pageImageWidth) * 100}%`,
          top: `${(box.y / slide.pageImageHeight) * 100}%`,
          width: `${(box.width / slide.pageImageWidth) * 100}%`,
          height: `${(box.height / slide.pageImageHeight) * 100}%`,
          ...highlightBoxStyle,
        }}
      />
    ))}
  </>
);

const CroppedEvidenceFigure = ({
  sessionId,
  slide,
  className,
  compact = false,
}: {
  sessionId: string;
  slide: DisputeEvidenceSlide;
  className?: string;
  compact?: boolean;
}) => {
  const imageUrl = `/api/sessions/${sessionId}/pages/${slide.pageNumber}/image`;
  const viewportWidthPercent = (slide.pageImageWidth / slide.cropBox.width) * 100;
  const viewportHeightPercent = (slide.pageImageHeight / slide.cropBox.height) * 100;
  const offsetLeftPercent = (slide.cropBox.x / slide.cropBox.width) * 100;
  const offsetTopPercent = (slide.cropBox.y / slide.cropBox.height) * 100;
  const compactDimensions = compact ? buildCompactPreviewDimensions(slide) : null;

  const figure = (
    <div
      className={cn("relative overflow-hidden rounded-xl border border-black/15 bg-[#f6f3ed]", className)}
      style={
        compactDimensions
          ? {
              width: `${compactDimensions.width}px`,
              aspectRatio: `${slide.cropBox.width} / ${slide.cropBox.height}`,
            }
          : { aspectRatio: `${slide.cropBox.width} / ${slide.cropBox.height}` }
      }
    >
      <div className="absolute inset-0">
        <div
          className="absolute"
          style={{
            width: `${viewportWidthPercent}%`,
            height: `${viewportHeightPercent}%`,
            left: `-${offsetLeftPercent}%`,
            top: `-${offsetTopPercent}%`,
          }}
        >
          <img src={imageUrl} alt={`Evidence crop from report page ${slide.pageNumber}`} className="h-full w-full object-fill" />
          <HighlightBoxes slide={slide} />
        </div>
      </div>
    </div>
  );

  if (compact) {
    return <div className="flex justify-center">{figure}</div>;
  }

  return figure;
};

const FullPageEvidenceFigure = ({ sessionId, slide }: { sessionId: string; slide: DisputeEvidenceSlide }) => {
  const imageUrl = `/api/sessions/${sessionId}/pages/${slide.pageNumber}/image`;
  return (
    <div className="mx-auto w-full max-w-5xl rounded-xl border border-black/15 bg-white shadow-sm">
      <div className="border-b border-dashed border-black/15 px-4 py-3 text-sm text-slate-600">
        Page {slide.pageNumber} with all localized dispute highlights shown in context.
      </div>
      <div className="p-4 md:p-6">
        <div className="relative mx-auto overflow-hidden rounded-lg border border-black/10 bg-white" style={{ aspectRatio: `${slide.pageImageWidth} / ${slide.pageImageHeight}` }}>
          <img src={imageUrl} alt={`Full report page ${slide.pageNumber}`} className="absolute inset-0 h-full w-full object-fill" />
          <HighlightBoxes slide={slide} />
        </div>
      </div>
    </div>
  );
};

const EvidenceSlideCard = ({
  sessionId,
  slide,
  compact = false,
}: {
  sessionId: string;
  slide: DisputeEvidenceSlide;
  compact?: boolean;
}) => {
  const highlightedCropImageUrl = buildHighlightedCropImageUrl(sessionId, slide);
  const actionButtons = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <FileImage className="mr-2 h-4 w-4" />
            Open full page
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle>{slide.label}</DialogTitle>
            <DialogDescription>
              Full source page with the exact yellow dispute highlights used for this evidence bundle.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(92vh-88px)] overflow-auto bg-[#ece7df] p-4 md:p-6">
            <FullPageEvidenceFigure sessionId={sessionId} slide={slide} />
          </div>
        </DialogContent>
      </Dialog>
      <Button asChild variant="ghost" size="sm" className="w-full sm:w-auto">
        <a href={highlightedCropImageUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="mr-2 h-4 w-4" />
          Open image
        </a>
      </Button>
    </div>
  );

  if (compact) {
    return (
      <div className="rounded-xl border border-black/10 bg-white/80 p-3">
        <div className="space-y-4">
          <CroppedEvidenceFigure
            sessionId={sessionId}
            slide={slide}
            compact
            className="mx-auto"
          />
          <div className="space-y-3">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{slide.label}</p>
                <p className="text-xs text-slate-500">
                  Page {slide.pageNumber} · confidence {Math.round(slide.confidence * 100)}%
                </p>
              </div>
              {actionButtons}
            </div>
            {slide.matchedText ? (
              <div className="rounded-lg border border-dashed border-black/15 bg-[#faf8f2] px-3 py-2 text-xs leading-6 text-slate-600 break-words">
                {slide.matchedText}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CroppedEvidenceFigure sessionId={sessionId} slide={slide} />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{slide.label}</p>
          <p className="text-xs text-slate-500">
            Page {slide.pageNumber} · confidence {Math.round(slide.confidence * 100)}%
          </p>
        </div>
        {actionButtons}
      </div>
      {slide.matchedText ? (
        <div className="rounded-lg border border-dashed border-black/15 bg-white/80 px-3 py-2 text-xs leading-6 text-slate-600">
          {slide.matchedText}
        </div>
      ) : null}
    </div>
  );
};

interface DisputeReasonEvidencePanelProps {
  draft: DisputeLetterDraft;
  reason: DisputeReason;
  bundle?: DisputeReasonEvidenceBundle | null;
  className?: string;
  compact?: boolean;
}

export function DisputeReasonEvidencePanel({
  draft,
  reason,
  bundle,
  className,
  compact = false,
}: DisputeReasonEvidencePanelProps) {
  const slideCount = bundle?.slides.length ?? 0;
  const evidenceSessionId = draft.evidenceManifest?.sessionId ?? draft.sessionId;
  const hasSlides = Boolean(bundle && slideCount > 0);
  const isReady = bundle?.status === "ready";
  const isExportBlocker = Boolean(bundle?.requiresCanonicalProvenance && bundle?.status !== "ready");
  const isValidationBlocker = Boolean(bundle?.blockedByValidation);
  const showHardAlert = !bundle || slideCount === 0;
  const showReviewAlert = Boolean(bundle && !isReady && slideCount > 0);
  const pillText = isReady
    ? `${slideCount} evidence slide${slideCount === 1 ? "" : "s"}`
    : hasSlides
      ? `Review ${slideCount} slide${slideCount === 1 ? "" : "s"}`
      : "Localization needed";
  const reviewMessage = isExportBlocker || isValidationBlocker
    ? "These proof slides are available for review, but the exact export-grade placement is not locked yet. The highlighted report will stay blocked until this reason is mapped precisely enough."
    : bundle?.resolutionMode === "legacy"
      ? "These proof slides are available for review. This reason is still on the legacy evidence path, so the preview is shown here without claiming export-grade placement."
      : "These proof slides are available for review, but the evidence still needs more precise mapping before it can be treated as export-grade.";

  return (
    <div className={cn("rounded-lg border border-black/15 bg-[#faf8f2] p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Highlighted source proof</p>
          <h4 className="mt-1 text-sm font-semibold text-slate-900">{reason.issueLabel}</h4>
          <p className="mt-1 text-xs text-slate-500">
            {reasonEntityLabel(reason)} · pages {formatPageList(bundle?.sourcePages ?? reason.sourcePages)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em]",
            isReady
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
              : hasSlides
                ? "border-amber-500/40 bg-amber-50 text-amber-800"
                : "border-yellow-500/40 bg-yellow-50 text-yellow-800",
          )}
        >
          {pillText}
        </span>
      </div>

      {showHardAlert ? (
        <Alert variant="destructive" className="mt-4 border-yellow-500/50 bg-yellow-50 text-yellow-950">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Evidence could not be localized precisely enough</AlertTitle>
          <AlertDescription>
            {bundle?.requiresCanonicalProvenance
              ? "This dispute will remain blocked from highlighted export until its source regions can be mapped with export-grade placement."
              : "The system could not build a usable localized proof preview for this reason yet. This is not a normal loading state; the source regions still need to be mapped more precisely."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="mt-4">
          {showReviewAlert ? (
            <Alert className="mb-4 border-amber-500/40 bg-amber-50 text-amber-950">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Evidence is available, but still under review</AlertTitle>
              <AlertDescription>{reviewMessage}</AlertDescription>
            </Alert>
          ) : null}
          {compact ? (
            <div className="space-y-4">
              {bundle.slides.map((slide) => (
                <EvidenceSlideCard
                  key={slide.id}
                  sessionId={evidenceSessionId}
                  slide={slide}
                  compact
                />
              ))}
            </div>
          ) : (
            <Carousel className="px-10 md:px-14">
              <CarouselContent>
                {bundle.slides.map((slide) => (
                  <CarouselItem key={slide.id}>
                    <EvidenceSlideCard sessionId={evidenceSessionId} slide={slide} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {bundle.slides.length > 1 ? (
                <>
                  <CarouselPrevious className="left-0 h-10 w-10 rounded-none border-black/20 bg-white" />
                  <CarouselNext className="right-0 h-10 w-10 rounded-none border-black/20 bg-white" />
                </>
              ) : null}
            </Carousel>
          )}
        </div>
      )}
    </div>
  );
}
