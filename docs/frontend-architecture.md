---
title: Frontend Architecture Reference
aliases:
  - frontend
  - react-app
  - client-architecture
tags:
  - docs
  - frontend
  - react
  - typescript
created: 2026-03-25
description: >
  Comprehensive technical reference for the Credit Clarify React/TypeScript
  frontend. Covers routing, component hierarchy, state management via
  ReportWorkspaceContext, the CreditReport data model, PDF upload pipeline,
  client-side parsing orchestrator, security hardening, and Zustand stores.
related:
  - "[[extraction-pipeline]]"
  - "[[dispute-generation]]"
  - "[[node-editor]]"
  - "[[backend-api]]"
---

> **Living doc.** Update this file whenever frontend code changes.

# Frontend Architecture Reference

## Table of Contents

1. [Application Entry Point](#application-entry-point)
2. [Provider Stack](#provider-stack)
3. [Route Table](#route-table)
4. [Component Hierarchy](#component-hierarchy)
5. [Layout Shell](#layout-shell)
6. [Page Components](#page-components)
7. [State Management -- ReportWorkspaceContext](#state-management----reportworkspacecontext)
8. [CreditReport Data Model](#creditreport-data-model)
9. [PDF Upload Pipeline](#pdf-upload-pipeline)
10. [Client-Side Parser Orchestrator](#client-side-parser-orchestrator)
11. [Security Hardening](#security-hardening)
12. [Zustand Stores](#zustand-stores)
13. [Data Flow Diagrams](#data-flow-diagrams)

---

## Application Entry Point

**File:** `src/main.tsx` (17 lines)

The bootstrap sequence:

1. **Security hardening** -- `import './lib/security/hardenClientDiagnostics.ts'` is the very first import (line 2). It executes immediately on module evaluation and suppresses native console methods, installs global error/rejection handlers, and dispatches `credit-clarifier:runtime-error` custom events.
2. **CSS** -- `index.css` and `styles/pdf-uploader.css` are loaded (lines 8-9).
3. **Render** -- `ReactDOM.createRoot` mounts into `#root` (line 10) with:
   - `React.StrictMode` -- double-invokes effects in development.
   - `AppRuntimeBoundary` -- catches render errors and unhandled runtime exceptions. Displays a recovery fallback UI rather than a white screen.
   - `App` -- the root component.

```
React.StrictMode
  -> AppRuntimeBoundary  (src/components/AppRuntimeBoundary.tsx)
       -> App             (src/App.tsx)
```

### AppRuntimeBoundary

**File:** `src/components/AppRuntimeBoundary.tsx` (103 lines)

Two-layer error boundary:

| Layer | Mechanism | Catches |
|-------|-----------|---------|
| `RenderErrorBoundary` (class component, line 58) | `getDerivedStateFromError` / `componentDidCatch` | Synchronous render throws |
| `AppRuntimeBoundary` (function component, line 85) | Listens to `credit-clarifier:runtime-error` custom event | Async errors, unhandled rejections |

Both layers render the same `RuntimeFallback` component (line 7), which offers "Reload Workspace" and "Go To Upload" actions.

---

## Provider Stack

Defined in `src/App.tsx` (57 lines). Providers wrap the route tree in this order (outermost first):

```
QueryClientProvider          (@tanstack/react-query)
  TooltipProvider            (shadcn/ui tooltip)
    Toaster + Sonner         (toast notification portals)
    BrowserRouter            (react-router-dom v6)
      ReportWorkspaceProvider (application state context)
        <Routes />
```

- **QueryClient** is created at module scope (line 15) with default options.
- **ReportWorkspaceProvider** must be inside `BrowserRouter` because it calls `useNavigate` and `useLocation`.

---

## Route Table

All routes are defined in `src/App.tsx`, lines 24-49. Every primary route wraps its page in the `Layout` component.

### Primary Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `UploadPage` | Default landing; PDF upload intake |
| `/upload` | `UploadPage` | Explicit upload path |
| `/acquire` | `AcquireReportsPage` | Guided browser retrieval (see `[[acquisition-pipeline]]`) |
| `/report` | `ReportPage` | Parsed credit report display |
| `/dispute` | `DisputePage` | Dispute letter workflow |
| `/settings` | `SettingsPage` | Integrations, diagnostics, node editor |
| `*` | `NotFound` | 404 catch-all (no Layout wrapper) |

### Redirect Routes

Legacy and convenience paths redirect to the canonical routes:

| From | To |
|------|----|
| `/reports` | `/report` |
| `/reports/upload` | `/upload` |
| `/reports/view` | `/report` |
| `/reports/dispute` | `/dispute` |
| `/webhooks` | `/settings?section=integrations` |
| `/developer` | `/settings?section=developer` |
| `/debugger` | `/settings?section=diagnostics` |

All redirects use `replace` to avoid polluting browser history.

---

## Component Hierarchy

```
main.tsx
  React.StrictMode
    AppRuntimeBoundary
      App
        QueryClientProvider
          TooltipProvider
            Toaster / Sonner
            BrowserRouter
              ReportWorkspaceProvider
                Routes
                  Layout
                    UploadPage
                      PDFUploader
                        PDFUploadPlaceholder | PDFProgressDisplay
                    ReportPage
                      DossierReportView | DossierEmptyState
                    DisputePage
                      DisputeLetterWorkflow | DossierEmptyState
                    AcquireReportsPage
                      (form + agent browser session UI)
                    SettingsPage
                      WebhookManager
                      ParsingDebugger
                      NodeEditor
                  NotFound
```

---

## Layout Shell

**File:** `src/components/Layout.tsx` (189 lines)

The `Layout` component provides the persistent chrome around every page:

- **Desktop** (>= `lg`): fixed sidebar with logo, primary nav, workflow nav, and session metadata (report reference, environment label).
- **Mobile** (< `lg`): top bar with hamburger menu that opens a `Sheet` overlay for navigation.

### Navigation Items

Defined as arrays at lines 44-91:

| Group | Items |
|-------|-------|
| Primary | Dashboard, Reports [+] |
| Workflow | Upload PDF, Get Reports, Report View, Dispute Letter, Settings |

Protected routes (`/report`, `/dispute`) go through `openProtectedRoute()` which checks for an active report before navigating.

---

## Page Components

### UploadPage

**File:** `src/pages/UploadPage.tsx` (164 lines)

The main PDF intake page. Consumes from `useReportWorkspace`:
- `creditReport`, `isProcessing`, `processingError`, `reportReference`, `environmentLabel`
- `handlePDFUploaded`, `handleProcessingComplete`, `setIsProcessing`, `refreshApp`

**Layout:** Two-column grid (`xl:grid-cols-[minmax(0,1.1fr)_380px]`):
- Left: `PDFUploader` component
- Right: session metadata sidebar (report reference, environment, status, privacy note, link to guided retrieval)

When `creditReport` is populated, a "Ready for Review" section appears with navigation to `/report` and `/dispute`.

### ReportPage

**File:** `src/pages/ReportPage.tsx` (54 lines)

Conditionally renders:
- **No report:** `DossierEmptyState` with buttons to upload or open settings.
- **Has report:** `DossierReportView` component, passing the `creditReport` object and callbacks for refresh, settings, and download.

### DisputePage

**File:** `src/pages/DisputePage.tsx` (55 lines)

Conditionally renders:
- **No report:** `DossierEmptyState` prompting upload.
- **Has report:** `DisputeLetterWorkflow` component with the full dispute drafting interface.

Uses `getReportReference()` utility to display the active report number in the subtitle.

### AcquireReportsPage

**File:** `src/pages/AcquireReportsPage.tsx` (1320 lines)

> Full documentation in `[[acquisition-pipeline]]`. This section notes the route entry only.

Route: `/acquire`. Guided retrieval page that launches a remote-controlled browser session to AnnualCreditReport.com, stages three bureau PDFs, and extracts them on explicit user approval.

### SettingsPage

**File:** `src/pages/SettingsPage.tsx` (149 lines)

Consolidated operational tools page with three sections navigable via `?section=` query parameter:

| Section Key | Component | Purpose |
|-------------|-----------|---------|
| `integrations` | `WebhookManager` | Inbound/outbound webhook configuration |
| `diagnostics` | `ParsingDebugger` | Report extraction monitoring |
| `developer` | `NodeEditor` | Visual pipeline editor (Zustand-backed) |

Also includes an "Advanced UI Visibility" toggle that persists to `localStorage` and controls whether developer-facing surfaces appear throughout the app.

### NotFound

**File:** `src/pages/NotFound.tsx` (39 lines)

Simple 404 page. Logs the attempted path via `devDiagnostics.error()` and offers a "Return to Dashboard" link.

---

## State Management -- ReportWorkspaceContext

**File:** `src/features/workspace/ReportWorkspaceContext.tsx` (392 lines)

This is the primary application state container. It uses React Context (no external state library) with `useMemo` memoization on the value object.

### Context Shape

```typescript
interface ReportWorkspaceContextValue {
  // --- State ---
  creditReport: CreditReport | null;            // The active parsed report
  userProfileReports: RetrievedCreditReportAsset[]; // Staged bureau PDFs from guided retrieval
  isProcessing: boolean;                         // True during PDF extraction
  processingError: string | null;                // Last processing error message
  showDebugger: boolean;                         // Debugger panel visibility
  advancedUiEnabled: boolean;                    // Developer surface toggle
  reportReference: string;                       // Human-readable report identifier
  environmentLabel: string;                      // "Production" | "Development"
  hasReport: boolean;                            // Boolean(creditReport)
  hasRetrievedReports: boolean;                  // userProfileReports.length > 0

  // --- Setters ---
  setIsProcessing: (processing: boolean) => void;
  setShowDebugger: (value: boolean) => void;
  setAdvancedUiEnabled: (value: boolean) => void;
  setProcessingError: (value: string | null) => void;

  // --- Profile Report Actions ---
  syncUserProfileReports: (reports: Pick<RetrievedCreditReportAsset, ...>[]) => void;
  updateUserProfileReport: (bureauKey: string, patch: Partial<RetrievedCreditReportAsset>) => void;
  clearUserProfileReports: () => void;

  // --- Report Lifecycle ---
  activateExtractedReport: (report: CreditReport) => Promise<void>;
  handlePDFUploaded: (file: File, text: string, parsedReport?: CreditReport, options?) => Promise<void>;
  handleProcessingComplete: () => void;
  refreshApp: () => void;

  // --- Navigation Guards ---
  requestProtectedRoute: (destination: "report" | "dispute") => boolean;
  openProtectedRoute: (destination: "report" | "dispute") => void;
}
```

### Persistence

| Data | Storage | Key |
|------|---------|-----|
| Active report (`creditReport`) | `sessionStorage` | `credit-clarifier.active-report` |
| Advanced UI preference | `localStorage` | `credit-clarifier.advanced-ui` |

The stored report uses a versioned envelope (`{ version: 1, report }`) read by `readStoredReport()` (line 62) and written by `writeStoredReport()` (line 85). On mount, the provider initializes from stored state via `useRef`.

### Key Functions

| Function | Line | Purpose |
|----------|------|---------|
| `readStoredReport()` | 62 | Reads versioned report from sessionStorage |
| `writeStoredReport()` | 85 | Writes or clears report in sessionStorage |
| `readStoredAdvancedUi()` | 108 | Reads boolean preference from localStorage |
| `writeStoredAdvancedUi()` | 121 | Persists boolean preference to localStorage |
| `handlePDFUploaded()` | 160 | Receives parsed report from upload pipeline, calls `preloadInitialDisputeWorkspace`, then sets `creditReport` |
| `syncUserProfileReports()` | 200 | Merges incoming profile reports with existing extraction state |
| `updateUserProfileReport()` | 218 | Patches a single bureau report by `bureauKey` |
| `clearUserProfileReports()` | 231 | Clears all staged reports, triggers session cleanup for orphaned sessions |
| `activateExtractedReport()` | 243 | Opens a report from the acquisition pipeline (preloads dispute workspace, sets as active) |
| `requestProtectedRoute()` | 263 | Guard check: returns false and shows toast if no report or still processing |
| `openProtectedRoute()` | 286 | Guard + navigate: calls `requestProtectedRoute`, then `startTransition(() => navigate(...))` |

### Side Effects (useEffect hooks)

| Lines | Trigger | Behavior |
|-------|---------|----------|
| 295-316 | `creditReport`, `isProcessing` | Announces "Credit Report Ready" toast, auto-navigates to `/report` if on upload page |
| 318-325 | `creditReport.sourceSessionId` | Cleans up previous backend session when active report changes |
| 327-329 | `creditReport` | Persists active report to sessionStorage |
| 331-336 | `advancedUiEnabled` | Persists preference, hides debugger when advanced UI is disabled |

### Hook Export

```typescript
export const useReportWorkspace = () => {
  const context = useContext(ReportWorkspaceContext);
  if (!context) {
    throw new Error("useReportWorkspace must be used within a ReportWorkspaceProvider");
  }
  return context;
};
```

---

## CreditReport Data Model

**File:** `src/lib/types/creditReport.ts` (292 lines)

### Core Type

```typescript
export interface CreditReport {
  bureau: 'Equifax' | 'Experian' | 'TransUnion' | 'Unknown';
  profileId?: string;
  reportDate: string;
  personalInfo: PersonalInfo;
  accounts: Account[];
  collections?: Collection[];
  accountSummaries?: AccountSummary[];
  inquiries: Inquiry[];
  publicRecords: PublicRecord[];
  consumerInformationIndicators?: ConsumerInformationIndicator[];
  creditScores: CreditScore[];
  rawText: string;

  // Identity & tracking
  reportId?: string;
  fileName?: string;
  sourceSessionId?: string;

  // Extraction metadata
  targetTable?: string;
  componentStatus?: Record<string, "complete" | "failed">;
  validationIssues?: Array<{ component: string; severity: string; code: string; message: string }>;
  sourceComponents?: Partial<Record<SourceComponentKey, SourceSection>>;

  // Derived display fields
  recentInquiry?: string;
  personalInfoItemCount?: number;
  inquiryCount?: number;
  publicRecordCount?: number;
  collectionCount?: number;
  statementCount?: number;
  confirmationNumber?: string;
  creditFileStatus?: string;
  alertContacts?: string;
  averageAccountAge?: string;
  lengthOfCreditHistory?: string;
  accountsWithNegativeInfo?: string | number;
  oldestAccount?: { accountName: string; openDate: string };
  recentAccount?: { accountName: string; openDate: string };
  consumerName?: string;
  readyForAttorney?: boolean;
  components?: Record<string, unknown>;
  inquiryBuckets?: {
    hardInquiries: Inquiry[];
    softInquiries: Inquiry[];
    hardInquiryCount: number;
    softInquiryCount: number;
  };

  parsingError?: string;
}
```

### Supporting Types

| Type | Line | Key Fields |
|------|------|------------|
| `PersonalInfo` | 183 | `name`, `addresses[]`, `currentAddresses?[]`, `previousAddresses?[]`, `ssn?`, `dob?`, `employmentHistory?` |
| `Account` | 42 | `accountName`, `accountNumber`, `accountType`, `status`, `balance`, `paymentHistory[]`, `openDate`, plus ~60 optional fields covering dates, amounts, history matrices, and source debug data |
| `Collection` | 117 | `collectionAgency`, `originalCreditorName`, `amount`, `status`, `dateReported`, `comments[]`, `contact[]` |
| `Inquiry` | 173 | `subscriberName`, `inquiryDate`, `purpose`, `inquiryType?: "hard" \| "soft"` |
| `PublicRecord` | 142 | `recordType`, `court`, `amount`, `dateFiled`, `dateResolved`, `status` |
| `CreditScore` | 194 | `score: number`, `range`, `provider`, `date` |
| `AccountSummary` | 201 | `accountType`, `totalAccounts`, `balance`, `creditLimit`, `debtToCredit` |
| `MonthlyHistoryEntry` | 2 | `year` + 12 month fields (`jan`..`dec`) |
| `ConsumerInformationIndicator` | 164 | `code`, `description`, `category`, `linkedAccountName?` |
| `RetrievedCreditReportAsset` | 282 | `bureau`, `bureauKey`, `fileName`, `downloadUrl`, `sizeBytes`, `extractionStatus`, `extractedReport?` |
| `SourceComponentKey` | 18 | Union of 17 string literal keys representing report sections |

---

## PDF Upload Pipeline

### PDFUploader Component

**File:** `src/components/PDFUploader.tsx` (117 lines)

A drag-and-drop file upload component. Props:

```typescript
interface PDFUploaderProps {
  onPDFUploaded: (file, text, parsedReport?, options?) => Promise<void> | void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  onProcessingComplete: () => void;
}
```

Delegates to the `usePDFUpload` hook. Renders conditionally:
- **Idle:** `PDFUploadPlaceholder` with a hidden file input covering the drop zone.
- **Active:** `PDFProgressDisplay` showing file name, progress bar, and stage label.

Error display uses a destructive `Alert` component above the drop zone.

### usePDFUpload Hook

**File:** `src/hooks/usePDFUpload.ts` (183 lines)

Core hook managing the upload lifecycle.

#### Key Constants

| Name | Value | Purpose |
|------|-------|---------|
| `EXTRACTION_PROGRESS_MAX` | 70 | Server extraction progress caps at 70% of the UI bar |

#### State

| State Variable | Type | Purpose |
|----------------|------|---------|
| `isDragging` | `boolean` | Drag-over visual feedback |
| `uploadProgress` | `number` | 0-100 progress percentage |
| `currentFile` | `File \| null` | The file being processed |
| `processingError` | `string \| null` | Error message |
| `processingComplete` | `boolean` | Terminal state flag |
| `currentStage` | `string` | Human-readable stage label |

#### Key Functions

| Function | Line | Purpose |
|----------|------|---------|
| `syncProgress()` | 43 | Normalizes incoming `SessionProgressUpdate`, handles "reviewing highlight localization" slow-tick timer (1.4s intervals from 94% to 99%) |
| `processPDF()` | 69 | Main pipeline: calls `processCreditReportPdfWithSessionApi`, scales server progress to 0-70%, then hands off to `onPDFUploaded` callback for 72-100% |
| `handleDragOver()` | 125 | Sets `isDragging` true |
| `handleDragLeave()` | 130 | Sets `isDragging` false |
| `handleDrop()` | 135 | Validates PDF MIME type, calls `processPDF()` |
| `handleFileInputChange()` | 149 | Reads file from `<input>`, resets input value, calls `processPDF()` |
| `triggerFileInput()` | 161 | Programmatic file picker trigger |

#### Return Value

```typescript
{
  isDragging, uploadProgress, currentFile, fileInputRef,
  handleDragOver, handleDragLeave, handleDrop, handleFileInputChange,
  triggerFileInput, processingError, processingComplete, currentStage,
}
```

---

## Client-Side Parser Orchestrator

**File:** `src/lib/creditReportParser.ts` (162 lines)

### Exported Function

```typescript
export const parseCreditReport = async (
  text: string,
  useAIFirst = true
): Promise<CreditReport>
```

**Line 16.** This is the main client-side parser entry point. It is called by the backend session pipeline, not directly by the upload UI (which uses the session API).

### Parsing Strategy

```
parseCreditReport(text, useAIFirst)
  |
  +-- identifyBureau(text)        // lib/parsers/bureauIdentifier
  |
  +-- [AI-first path] (if useAIFirst=true)
  |     |-- parseWithAI(text)                    // lib/ai
  |     |-- extractReportSummaryWithAI(text)     // lib/ai/summaryExtraction
  |     |-- extractPersonalInfo(text)            // lib/parsers/personalInfoParser
  |     |-- extractAccounts(text)                // lib/parsers/accountsParser
  |     |-- extractCreditScores(text)            // lib/parsers/creditScoreParser
  |     |-- [Equifax] parseEquifaxReport(text)   // lib/parsers/equifax/equifaxParser
  |     +-- return combinedReport
  |
  +-- [Traditional fallback] (if AI fails or useAIFirst=false)
  |     |-- extractDate(text)
  |     |-- extractPersonalInfo(text)
  |     |-- extractAccounts(text)
  |     |-- extractCreditScores(text)
  |     |-- [Equifax] parseEquifaxReport(text)
  |     |-- enhanceCreditReportWithAI(text, initialReport)
  |     +-- return enhancedReport
  |
  +-- [Critical failure]
        +-- return minimal report with parsingError
```

### Parser Dependencies

| Parser Module | Purpose |
|---------------|---------|
| `lib/parsers/bureauIdentifier` | Identifies Equifax, Experian, TransUnion, or Unknown from raw text |
| `lib/parsers/dateParser` | Extracts report date |
| `lib/parsers/personalInfoParser` | Extracts name, addresses, SSN, DOB |
| `lib/parsers/creditScoreParser` | Extracts credit scores |
| `lib/parsers/accountsParser` | Extracts trade lines / accounts |
| `lib/parsers/equifax/equifaxParser` | Bureau-specific parsing for Equifax reports |
| `lib/ai` | AI-powered extraction (`parseWithAI`, `enhanceCreditReportWithAI`) |
| `lib/ai/summaryExtraction` | AI-powered summary field extraction |

All parsing activity is instrumented through `parsingLogger` (from `@/utils/parsingLogger`).

---

## Security Hardening

### hardenClientDiagnostics

**File:** `src/lib/security/hardenClientDiagnostics.ts` (65 lines)

Self-executing module (imported at the top of `main.tsx`). Runs `hardenClientDiagnostics()` on line 65.

**Behavior:**

1. **Console suppression** (lines 35-41): Overwrites all console methods (`log`, `info`, `debug`, `warn`, `error`, `trace`, `dir`, `dirxml`, `table`, `group`, `groupCollapsed`, `groupEnd`) with a no-op function. Prevents leaking diagnostic information in production.

2. **Global error handler** (lines 43-57): Listens on `window.error`. Ignores resource load failures (e.g., missing images). For actual JS errors, sets `window.__CREDIT_CLARIFIER_RUNTIME_ERROR__ = true` and dispatches a `credit-clarifier:runtime-error` custom event. Calls `event.preventDefault()` to suppress default browser error logging.

3. **Unhandled rejection handler** (lines 59-62): Same signaling pattern for unhandled promise rejections.

**Integration:** The `AppRuntimeBoundary` component listens for the `credit-clarifier:runtime-error` event and renders the `RuntimeFallback` UI when it fires.

### devDiagnostics

**File:** `src/lib/security/devDiagnostics.ts` (7 lines)

A `Proxy` that returns a no-op for every property access. Used throughout the codebase as a safe replacement for `console` logging:

```typescript
export const devDiagnostics = new Proxy({} as Console, {
  get() { return NOOP; },
});
```

All calls like `devDiagnostics.log(...)`, `devDiagnostics.error(...)`, `devDiagnostics.warn(...)` silently do nothing. This provides a single point of control for diagnostic output without relying on build-time stripping.

---

## Zustand Stores

### Pipeline Store

**File:** `src/features/node-editor/store/pipelineStore.ts` (198 lines)

The only Zustand store in the application. Powers the visual node editor on the Settings page.

```typescript
interface PipelineState {
  // Pipeline data
  currentPipeline: PipelineDefinition | null;
  nodes: PipelineNode[];
  edges: PipelineEdge[];

  // Execution
  isExecuting: boolean;
  executionResult: ExecutionResult | null;
  executionLog: ExecutionLogEntry[];

  // Selection
  selectedNodeId: string | null;

  // Actions
  loadPipelineById: (id: string) => void;
  createDefaultPipeline: (name: string) => void;
  createNewPipeline: (name: string) => void;
  updatePipeline: (updates: Partial<PipelineDefinition>) => void;
  saveCurrentPipeline: () => void;
  setNodes: (nodes: PipelineNode[]) => void;
  setEdges: (edges: PipelineEdge[]) => void;
  updateNode: (nodeId: string, updates: Partial<PipelineNode['data']>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setExecuting: (isExecuting: boolean) => void;
  setExecutionResult: (result: ExecutionResult | null) => void;
  setExecutionLog: (log: ExecutionLogEntry[]) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus, error?: string) => void;
  reset: () => void;
}
```

**Persistence:** Pipelines are serialized to `localStorage` via `savePipeline()` / `loadPipeline()` from `features/node-editor/core/serialization`.

**Usage:** Consumed by `NodeEditor` component tree on the `/settings?section=developer` page. Exported as `usePipelineStore` hook.

---

## Data Flow Diagrams

### PDF Upload to Report Display

```
User drops PDF
      |
      v
PDFUploader (component)
      |
      v
usePDFUpload.processPDF(file)
      |
      v
processCreditReportPdfWithSessionApi(file, onProgress)
      |                                          ^
      |  POST /api/sessions                      |  progress callbacks
      |  POST /api/sessions/:id/upload (chunked) |  (0% - 70% of UI bar)
      |  GET  /api/sessions/:id/status (polling)  |
      |  GET  /api/sessions/:id/result            |
      v                                          |
Backend returns CreditReport ------------------>+
      |
      v
onPDFUploaded(file, text, report, { onProgress })
      |
      v
ReportWorkspaceContext.handlePDFUploaded()
      |
      +-- preloadInitialDisputeWorkspace(report)
      |     |
      |     +-- buildInitialDisputePreparation(report)
      |     +-- createDisputeLetterDraft(...)        POST /api/dispute-drafts
      |     +-- waitForReadyHydratedDraft(...)       GET  /api/dispute-drafts/:key
      |     +-- onProgress callbacks (76% - 99%)
      |
      +-- setCreditReport(report)
      |
      v
useEffect: writeStoredReport(report) --> sessionStorage
useEffect: toast "Credit Report Ready"
useEffect: navigate("/report")
      |
      v
ReportPage renders DossierReportView
```

### Guided Retrieval to Report Display

```
AcquireReportsPage
      |
      +-- handleStartSession()
      |     POST /api/acquisition/sessions
      |
      +-- Poll getAcquisitionSessionStatus() every 1.5s
      |     GET /api/acquisition/sessions/:id
      |     |
      |     +-- session.downloadedReports
      |           |
      |           v
      |     syncUserProfileReports() --> userProfileReports state
      |
      +-- handleApproveExtraction()
      |     For each staged report:
      |       fetch(downloadUrl) --> blob --> File
      |       processCreditReportPdfWithSessionApi(file)
      |       updateUserProfileReport(bureauKey, { extractedReport })
      |
      +-- handleOpenExtractedReport(bureauKey)
            |
            v
      activateExtractedReport(report)
            |
            +-- preloadInitialDisputeWorkspace(report)
            +-- setCreditReport(report)
            |
            v
      navigate("/report")
```

### State Persistence Map

```
+-----------------------------+     +-----------------+
| sessionStorage              |     | localStorage    |
|                             |     |                 |
| credit-clarifier.           |     | credit-clarifier|
|   active-report             |     |   .advanced-ui  |
| { version: 1,              |     | "true" | "false"|
|   report: CreditReport }   |     |                 |
+-----------------------------+     +-----------------+
        ^         |                       ^       |
        |         v                       |       v
   writeStored  readStored          writeStored readStored
   Report()     Report()            AdvancedUi  AdvancedUi
        ^         |                       ^       |
        |         v                       |       v
+----------------------------------------------+
|         ReportWorkspaceProvider               |
|  creditReport  |  advancedUiEnabled           |
+----------------------------------------------+

+-----------------------+
| localStorage          |
| (pipeline-*)          |
+-- savePipeline() -----+-- pipelineStore (Zustand)
+-- loadPipeline() -----+
+-----------------------+
```
