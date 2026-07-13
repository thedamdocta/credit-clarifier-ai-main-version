import React, { useMemo } from "react";
import { FileImage, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DisputeLetterDraft } from "../types";

interface DisputeEvidenceReviewProps {
  draft: DisputeLetterDraft;
  isBusy: boolean;
  onRefreshEvidence: () => Promise<void> | void;
  onGenerateHighlightedReport: () => Promise<void> | void;
}

export default function DisputeEvidenceReview({
  draft,
  isBusy,
  onRefreshEvidence,
  onGenerateHighlightedReport,
}: DisputeEvidenceReviewProps) {
  const unresolvedReasonIds = draft.evidenceManifest?.unresolvedReasonIds ?? [];
  const blockingUnresolvedReasonIds = draft.evidenceManifest?.blockingUnresolvedReasonIds ?? [];
  const exportableReasonIds = draft.evidenceManifest?.exportableReasonIds ?? [];
  const hasEvidenceManifest = Boolean(draft.evidenceManifest);
  const readyBundleCount = useMemo(
    () => (draft.evidenceManifest?.reasons ?? []).filter((bundle) => bundle.status === "ready" && bundle.slides.length > 0).length,
    [draft.evidenceManifest],
  );
  const nonExportableReadyCount = Math.max(readyBundleCount - exportableReasonIds.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/15 bg-[#f7f3ea] px-4 py-4">
        <div>
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">Highlighted Report</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">Generate the marked full-report PDF</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Detailed highlighted proof now appears inline beneath each selected dispute on the Reasons step. Use this step only to refresh the shared evidence manifest and generate the separate full-report PDF with all selected-dispute highlights applied.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void onRefreshEvidence()} disabled={isBusy}>
            {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh Evidence
          </Button>
          <Button onClick={() => void onGenerateHighlightedReport()} disabled={isBusy || !hasEvidenceManifest || blockingUnresolvedReasonIds.length > 0 || exportableReasonIds.length === 0}>
            {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
            Generate Highlighted Report PDF
          </Button>
          {draft.renderState.highlightedReportPdfUrl ? (
            <Button asChild variant="outline">
              <a href={draft.renderState.highlightedReportPdfUrl} target="_blank" rel="noreferrer">Open Highlighted PDF</a>
            </Button>
          ) : null}
        </div>
      </div>

      {!hasEvidenceManifest ? (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Building the dispute evidence manifest</AlertTitle>
          <AlertDescription>
            The shared evidence manifest must be localized before the inline reason proof and the highlighted report PDF can be rendered accurately.
          </AlertDescription>
        </Alert>
      ) : null}

      {hasEvidenceManifest && blockingUnresolvedReasonIds.length > 0 ? (
        <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-50 text-yellow-950">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Highlighted report generation is blocked for canonical MVP reasons</AlertTitle>
          <AlertDescription>
            {blockingUnresolvedReasonIds.length} provenance-backed dispute{blockingUnresolvedReasonIds.length === 1 ? "" : "s"} could not be localized precisely enough for export-grade placement. Review the unresolved cards below before generating the highlighted report.
          </AlertDescription>
        </Alert>
      ) : null}

      {hasEvidenceManifest && blockingUnresolvedReasonIds.length === 0 && unresolvedReasonIds.length > 0 ? (
        <Alert className="border-black/15 bg-white text-slate-900">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Highlighted export is limited to the canonical MVP scope</AlertTitle>
          <AlertDescription>
            {unresolvedReasonIds.length} additional dispute{unresolvedReasonIds.length === 1 ? "" : "s"} are still running on the legacy localization path. They remain reviewable inline on the Reasons step, but the highlighted PDF currently exports only the provenance-backed Experian balance-history bundles.
          </AlertDescription>
        </Alert>
      ) : null}

      {draft.renderState.highlightedReportPdfPath ? (
        <div className="rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Highlighted report artifact</p>
          <p className="mt-1 break-all">{draft.renderState.highlightedReportPdfPath}</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-black/15 bg-white px-4 py-4">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Selected disputes</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{draft.selectedReasons.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            These are the disputes currently included in the saved draft and eligible for highlighted-report export.
          </p>
        </div>
        <div className="rounded-xl border border-black/15 bg-white px-4 py-4">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Localized bundles</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{readyBundleCount}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Inline highlighted screenshot proof is shown on the Reasons step for every localized dispute bundle.
          </p>
        </div>
        <div className="rounded-xl border border-black/15 bg-white px-4 py-4">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Export-grade bundles</p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{exportableReasonIds.length}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            These bundles are driven by canonical provenance and are eligible for the MVP highlighted full-report PDF.
          </p>
        </div>
      </div>

      {hasEvidenceManifest ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-black/15 bg-white px-4 py-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Blocking unresolved</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{blockingUnresolvedReasonIds.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              These are the canonical MVP disputes that still block highlighted-report export.
            </p>
          </div>
          <div className="rounded-xl border border-black/15 bg-white px-4 py-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Legacy pending migration</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{Math.max(unresolvedReasonIds.length - blockingUnresolvedReasonIds.length, 0) + nonExportableReadyCount}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              These disputes are still outside the canonical provenance MVP and are not included in the highlighted export yet.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-dashed border-black/15 bg-white/70 px-4 py-4 text-sm leading-6 text-slate-600">
        Return to <span className="font-semibold text-slate-900">Reasons</span> to review the per-dispute screenshot evidence inline with each selected account or non-account dispute. This step is intentionally limited to evidence refresh and highlighted-report generation so the proof is not duplicated in two places.
      </div>
    </div>
  );
}
