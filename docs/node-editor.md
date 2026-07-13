---
title: Node Editor -- Technical Reference
aliases:
  - visual-pipeline-editor
  - node-graph
  - pipeline-canvas
tags:
  - docs
  - node-editor
  - react-flow
  - pipeline
created: 2026-03-25
description: >
  Comprehensive reference for the visual node editor system that powers
  Credit Clarify's extraction pipelines. Covers the React Flow canvas,
  the 42 registered node types, the execution engine, the Zustand pipeline
  store, the node registry, and serialization/persistence.
related:
  - "[[extraction-pipeline]]"
  - "[[frontend-architecture]]"
---

> **Living doc.** Update this file whenever node editor code changes.

# Node Editor -- Technical Reference

The node editor is a visual, drag-and-drop pipeline builder built on
[React Flow](https://reactflow.dev/). It allows developers (and eventually
power-users) to wire together discrete processing steps -- PDF ingestion,
text extraction, AI parsing, account extraction, data transforms, and
output -- into a directed acyclic graph (DAG) that the execution engine
runs in topological order.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Editor UI (`NodeEditor.tsx`)](#2-editor-ui)
3. [Core Type System](#3-core-type-system)
4. [Node Registry](#4-node-registry)
5. [Execution Engine (`Executor.ts`)](#5-execution-engine)
6. [Pipeline Store (`pipelineStore.ts`)](#6-pipeline-store)
7. [Serialization & Persistence](#7-serialization--persistence)
8. [Component Inventory](#8-component-inventory)
9. [Complete Node Catalog (42 Nodes)](#9-complete-node-catalog-42-nodes)
10. [Default Pipeline Templates](#10-default-pipeline-templates)
11. [Security Notes (Phase 0)](#11-security-notes-phase-0)

---

## 1. Architecture Overview

```
src/features/node-editor/
  index.ts                        -- Public barrel exports
  components/
    NodeEditor.tsx                 -- Main canvas + toolbar + sheets
    CustomNode.tsx                 -- React Flow node renderer
    NodePalette.tsx                -- Draggable node library sidebar
    PropertiesPanel.tsx            -- Inspector / config panel (sheet)
  core/
    types/
      index.ts                    -- Re-export
      node.ts                     -- All shared types & interfaces
    registry/
      index.ts                    -- Re-export
      NodeRegistry.ts             -- Singleton registry class
    engine/
      index.ts                    -- Re-export
      Executor.ts                 -- Pipeline execution engine
    serialization/
      index.ts                    -- Re-export
      serialize.ts                -- localStorage CRUD, import/export
  hooks/
    usePipelineExecution.ts       -- React hook bridging store <-> engine
  store/
    pipelineStore.ts              -- Zustand store for all pipeline state
  nodes/
    index.ts                      -- Registers all 42 nodes
    base/
      BaseNodeExecutor.ts         -- Abstract base class for nodes
    input/   (3 nodes)
    processing/  (8 nodes)
    transform/  (11 nodes)
    ai/  (13 nodes)
    output/  (3 nodes)
    control/  (4 nodes)
  utils/
    defaultPipelines.ts           -- 4 pre-built pipeline templates
```

### Data-flow diagram (simplified)

```
 [Input Nodes]          [Processing]            [AI / LLM]            [Output]
 +------------+      +-----------------+     +------------------+    +----------+
 | PdfUpload  |----->| PdfExtractText  |---->| AccountExtraction|--->| Display  |
 | TextInput  |      | BureauIdent.    |     | CreditReportAI   |   | Export   |
 | ConfigSrc  |      | CreditParser    |     | OpenAI* (locked) |   | Webhook  |
 +------------+      +-----------------+     +------------------+    +----------+
                           |                        ^
                     [Transform]              [Control Flow]
                  +------------------+     +-------------------+
                  | Filter, Merge    |     | Conditional, Loop |
                  | DataMapper, etc. |     | ErrorHandler      |
                  +------------------+     +-------------------+
```

---

## 2. Editor UI

**File:** `src/features/node-editor/components/NodeEditor.tsx` (336 lines)

### Layout

| Region | Component | Visibility |
|--------|-----------|------------|
| Left sidebar (272 px) | `NodePalette` | Desktop only (`lg:flex`); mobile via Sheet |
| Top toolbar | Inline buttons | Always |
| Center | React Flow canvas (`<ReactFlow>`) | Always, min-height 640 px |
| Right sheet | `PropertiesPanel` | Opens on node click or Inspector button |

### Toolbar actions

| Button | Handler | Behavior |
|--------|---------|----------|
| **Node Library** | `setIsPaletteOpen(true)` | Opens left Sheet on mobile (`lg:hidden`) |
| **Inspector / Edit Node** | `setIsInspectorOpen(true)` | Opens right Sheet with `PropertiesPanel` |
| **Execute** | `handleExecute()` (line 164) | Calls `usePipelineExecution().executePipeline()`, toasts on success/failure |
| **Abort** | `abortExecution()` | Signals `AbortController`; only visible while executing |
| **Save** | `handleSave()` (line 173) | Calls `saveCurrentPipeline()` which persists to localStorage |

### Status bar metrics (line 261)

Displays live counts: **N Nodes**, **N Connections**, selected node label,
and last execution result (success + timing or failure).

### Hydration guards (lines 38-39, 69-111)

Two `useRef` flags (`hydratingNodesRef`, `hydratingEdgesRef`) prevent
infinite loops when syncing React Flow's local state with the Zustand
store. The pattern:

1. Store changes --> set flag, push into React Flow (`setNodes`).
2. React Flow `onChange` fires --> flag is true, skip writing back to store.
3. User drags/connects on canvas --> flag is false, write to store.

### Disconnected-node detection (line 70-84)

On every store change, each node is flagged `isDisconnected = true` if it
has no incoming edges (and is not an input node) OR no outgoing edges (and
is not an output node). `CustomNode` renders a red dashed border for
disconnected nodes.

### Default pipeline bootstrap (line 113-117)

If `currentPipeline` is null on mount, the editor calls
`createDefaultPipeline('Complete Backend Architecture (42 Nodes)')` which
loads the full 42-node template from `defaultPipelines.ts`.

---

## 3. Core Type System

**File:** `src/features/node-editor/core/types/node.ts` (148 lines)

### DataType (line 6)

The set of types that can flow between node ports:

| DataType | Description |
|----------|-------------|
| `file` | PDF `File` object |
| `text` | Extracted string content |
| `creditReport` | Parsed `CreditReport` object |
| `accounts` | `Account[]` array |
| `image` | Base64 data URL |
| `config` | Configuration object (API keys, settings) |
| `any` | Wildcard -- compatible with every other type |

### NodeStatus (line 15)

`'idle' | 'running' | 'success' | 'error'`

### NodeCategory (line 18)

`'input' | 'processing' | 'ai' | 'transform' | 'output' | 'control'`

### Key interfaces

| Interface | Purpose | Defined at |
|-----------|---------|-----------|
| `NodePort` | Input/output port definition (`id`, `label`, `dataType`, `required`) | line 22 |
| `NodeData` | Payload stored in each React Flow node (`label`, `type`, `category`, `config`, `inputs`, `outputs`, `status`, `error`, `result`, `isDisconnected`) | line 29 |
| `PipelineNode` | `ReactFlowNode<NodeData>` | line 43 |
| `PipelineEdge` | `ReactFlowEdge` | line 44 |
| `ExecutionContext` | Shared context for a pipeline run (`reportId`, `abortSignal`, `onProgress`, `cache`) | line 47 |
| `ValidationResult` | `{ valid: boolean; errors: string[] }` | line 55 |
| `ConfigField` | Schema for a single configuration field (used by `PropertiesPanel`) | line 71 |
| `ConfigSchema` | `{ fields: ConfigField[] }` | line 85 |
| `NodeExecutor` | Interface every node must implement (`type`, `category`, `label`, `description`, `getInputPorts`, `getOutputPorts`, `getConfigSchema`, `validate`, `execute`, optional `generateCode`) | line 90 |
| `ExecutionResult` | `{ success, results, error?, executionTime? }` | line 119 |
| `PipelineDefinition` | Full pipeline serialization shape (`id`, `name`, `description?`, `nodes`, `edges`, `createdAt`, `updatedAt`) | line 127 |
| `ExecutionLogEntry` | Per-node execution log (`nodeId`, `nodeLabel`, `status`, `timestamp`, `duration?`, `error?`, `inputs?`, `outputs?`) | line 138 |

### ConfigFieldType (line 61)

`'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'file' | 'apikey'`

---

## 4. Node Registry

**File:** `src/features/node-editor/core/registry/NodeRegistry.ts` (88 lines)

The registry is a **global singleton** (`nodeRegistry`) backed by a
`Map<string, NodeExecutor>`.

| Method | Signature | Purpose |
|--------|-----------|---------|
| `register` | `(executor: NodeExecutor) => void` | Adds or overwrites a node type (warns on overwrite) |
| `registerMany` | `(executors: NodeExecutor[]) => void` | Batch register |
| `getExecutor` | `(type: string) => NodeExecutor` | Lookup by type string; throws if not found |
| `hasExecutor` | `(type: string) => boolean` | Existence check |
| `getAllExecutors` | `() => NodeExecutor[]` | Returns all registered executors |
| `getExecutorsByCategory` | `(category: NodeCategory) => NodeExecutor[]` | Filter by category |
| `getCategories` | `() => NodeCategory[]` | Deduplicated list of registered categories |
| `clear` | `() => void` | Empties the registry |
| `count` | getter | Number of registered types |

### Registration

`registerDefaultNodes()` in `src/features/node-editor/nodes/index.ts`
(line 100) instantiates all 42 node classes and registers them. This
function is called at module scope in `NodeEditor.tsx` (line 30):

```ts
registerDefaultNodes(); // line 30, NodeEditor.tsx
```

---

## 5. Execution Engine

**File:** `src/features/node-editor/core/engine/Executor.ts` (351 lines)

### Class: `PipelineExecutor`

Constructor: `new PipelineExecutor(nodes, edges, registry)`

### `execute(context: ExecutionContext): Promise<ExecutionResult>`

The main entry point. Flow:

```
 1. validateGraph()
    |-- hasCycles()           DFS cycle detection (line 212)
    |-- required inputs       Check each required port has an edge
    |-- node config           Call executor.validate() per node
    |-- type compatibility    Ensure source/target port DataTypes match
    |
 2. topologicalSort()         Kahn's algorithm (line 249)
    |
 3. for each node in order:
    |-- check abortSignal
    |-- gatherInputs()        Collect outputs of upstream nodes via edges
    |-- executor.execute()    Run the node's logic
    |-- store result in Map
    |-- update node.data.status
    |-- log to executionLog
    |
 4. Return ExecutionResult { success, results, executionTime }
```

### Graph validation (`validateGraph`, line 125)

| Check | Method | Error message |
|-------|--------|---------------|
| Cycles | `hasCycles()` (DFS, line 212) | `Graph contains cycles` |
| Required inputs | Loop over `inputPorts` where `required === true` | `<label>: Required input "<port>" is not connected` |
| Node config | `executor.validate(config)` | Node-specific messages |
| Type compatibility | `isTypeCompatible()` (line 202) | `Type mismatch: <source>.<port> (<type>) -> <target>.<port> (<type>)` |

Type compatibility rule: **`any` is compatible with everything**; otherwise
types must match exactly (line 203).

### Topological sort (`topologicalSort`, line 249)

Uses Kahn's algorithm:
1. Compute in-degree for every node.
2. Enqueue all nodes with in-degree 0.
3. Process queue: decrement neighbor in-degrees, enqueue when zero.
4. If result length != node count, return `null` (cycle).

### Input gathering (`gatherInputs`, line 298)

For each incoming edge targeting `nodeId`:
- Look up the source node's result from the results `Map`.
- Extract the value at `results[sourceNodeId][edge.sourceHandle]`.
- Assign it to `inputs[edge.targetHandle]`.

### Execution hook (`usePipelineExecution`, line 22 of `usePipelineExecution.ts`)

React hook that:
1. Creates `PipelineExecutor` with current `nodes`, `edges`, `nodeRegistry`.
2. Builds `ExecutionContext` with `AbortController`, progress callback, and empty cache.
3. Calls `executor.execute(context)`.
4. Writes results and log to store via `setExecutionResult` / `setExecutionLog`.
5. Exposes `abortExecution()` to cancel via `AbortController.abort()`.

---

## 6. Pipeline Store

**File:** `src/features/node-editor/store/pipelineStore.ts` (199 lines)

Zustand store created with `create<PipelineState>()`.

### State shape

```ts
interface PipelineState {
  // Pipeline definition
  currentPipeline: PipelineDefinition | null;
  nodes: PipelineNode[];
  edges: PipelineEdge[];

  // Execution
  isExecuting: boolean;
  executionResult: ExecutionResult | null;
  executionLog: ExecutionLogEntry[];

  // Selection
  selectedNodeId: string | null;

  // ... actions (see below)
}
```

### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `loadPipelineById` | `(id: string) => void` | Loads from localStorage via `loadPipeline(id)` |
| `createDefaultPipeline` | `(name: string) => void` | Dynamically imports serialization, calls `createDefaultPipeline(name)`, sets state |
| `createNewPipeline` | `(name: string) => void` | Creates empty pipeline via `createEmptyPipeline(name)` |
| `updatePipeline` | `(updates: Partial<PipelineDefinition>) => void` | Merges partial updates into `currentPipeline`, bumps `updatedAt` |
| `saveCurrentPipeline` | `() => void` | Serializes `currentPipeline` + current `nodes`/`edges` to localStorage |
| `setNodes` | `(nodes: PipelineNode[]) => void` | Replaces node array |
| `setEdges` | `(edges: PipelineEdge[]) => void` | Replaces edge array |
| `updateNode` | `(nodeId, updates) => void` | Merges partial `NodeData` into a specific node |
| `setSelectedNode` | `(nodeId: string \| null) => void` | Sets or clears selection |
| `setExecuting` | `(isExecuting: boolean) => void` | Toggles execution flag |
| `setExecutionResult` | `(result \| null) => void` | Stores last run result |
| `setExecutionLog` | `(log: ExecutionLogEntry[]) => void` | Stores execution log |
| `updateNodeStatus` | `(nodeId, status, error?) => void` | Updates a single node's status during execution |
| `reset` | `() => void` | Resets entire store to initial state |

---

## 7. Serialization & Persistence

**File:** `src/features/node-editor/core/serialization/serialize.ts` (360 lines)

### localStorage keys

| Key | Purpose |
|-----|---------|
| `node-editor-pipelines` | JSON map of all saved pipelines keyed by `id` |
| `node-editor-active-pipeline` | ID of the currently active pipeline |
| `pipeline-mode` | `'classic'` or `'visual'` |

### Functions

| Function | Line | Purpose |
|----------|------|---------|
| `savePipeline(pipeline)` | 12 | Upsert pipeline into localStorage map |
| `loadPipeline(id)` | 29 | Load a single pipeline by ID |
| `loadAllPipelines()` | 42 | Load entire pipeline map |
| `deletePipeline(id)` | 58 | Remove from map; clear active if needed |
| `getActivePipelineId()` | 77 | Read active pipeline key |
| `setActivePipelineId(id)` | 84 | Write/clear active pipeline key |
| `getPipelineMode()` | 95 | Read mode (`'classic'` default) |
| `setPipelineMode(mode)` | 103 | Write mode |
| `exportPipeline(pipeline)` | 110 | Download as `.pipeline.json` via Blob |
| `importPipeline(file)` | 126 | Parse uploaded JSON, assign new ID |
| `generatePipelineId()` | 149 | `pipeline_<timestamp>_<random>` |
| `createEmptyPipeline(name)` | 156 | Returns empty `PipelineDefinition` |
| `createDefaultPipeline(name)` | 171 | Looks up template from `defaultPipelines.ts`; falls back to 6-node basic pipeline |
| `duplicatePipeline(pipeline)` | 350 | Deep copy with new ID and `(Copy)` suffix |

---

## 8. Component Inventory

### `CustomNode.tsx` (139 lines)

Memoized React Flow node renderer. Renders:
- Left handles for inputs (positioned proportionally).
- Right handles for outputs.
- Header with status icon (idle/running/success/error), label, category badge.
- Body with type string, disconnected warning, error message, success indicator.

Category color mapping:

| Category | Badge Color |
|----------|-------------|
| input | purple |
| processing | blue |
| ai | green |
| transform | yellow |
| output | orange |
| control | pink |

### `NodePalette.tsx` (172 lines)

Sidebar/sheet that lists all registered nodes grouped by category.
Features:
- Search filter on label and description.
- Collapsible category sections (input, processing, ai, output expanded by default).
- Click to add: creates a `PipelineNode` at a random canvas position with default config.

### `PropertiesPanel.tsx` (752 lines)

Right-side inspector sheet. Three tabs:
1. **Info** -- description, source file, backend function, example I/O.
2. **Prompt** -- shows prompt template if the node uses AI prompts.
3. **Code** -- source file path and backend function reference.

Also renders:
- Editable label field.
- Dynamic config form based on `getConfigSchema()` (supports text, number, boolean/switch, select, textarea, file, apikey).
- Input/output port listing with data types.
- Execution status and error display.
- Delete Node button.

---

## 9. Complete Node Catalog (42 Nodes)

### Base class: `BaseNodeExecutor`

**File:** `src/features/node-editor/nodes/base/BaseNodeExecutor.ts` (93 lines)

Abstract class implementing `NodeExecutor`. Provides:
- Default `validate()` that checks required fields and type constraints from `getConfigSchema()`.
- `reportProgress(context, nodeId, progress, message)` helper.
- `checkAbort(context)` helper that throws `'Execution aborted'` if the signal is triggered.

---

### INPUT (3 nodes)

| # | Name | Type String | Inputs | Outputs | Config | Purpose |
|---|------|-------------|--------|---------|--------|---------|
| 1 | **PDF Upload** | `input.pdf-upload` | -- | `file` (file), `metadata` (any) | `file` (file, required) | Source node. Accepts a PDF file upload and emits the `File` object plus metadata (name, size, type, lastModified). |
| 2 | **Text Input** | `input.text` | -- | `text` (text) | `text` (textarea, required) | Source node. Provides manually entered text for testing or custom data injection. |
| 3 | **Config Source** | `input.config` | -- | `config` (config) | `apiKey` (apikey), `customConfig` (textarea/JSON) | Source node. Supplies API keys and arbitrary JSON configuration to downstream nodes. |

---

### PROCESSING (8 nodes)

| # | Name | Type String | Inputs | Outputs | Config | Purpose |
|---|------|-------------|--------|---------|--------|---------|
| 4 | **PDF Extract Text** | `processing.pdf-extract-text` | `file` (file, req) | `text` (text), `pageCount` (any), `pageOffsets` (any) | -- | Extracts raw text from PDF using `extractTextFromPDF()` (PDF.js). Returns full text, page count, and character offset array per page. |
| 5 | **PDF to Image** | `processing.pdf-to-image` | `file` (file, req) | `images` (any) | `pageNumber` (number), `scale` (number, 0.5-5) | Renders a PDF page to a base64 data URL image via `convertPDFPageToImage()`. Used for OCR and vision AI inputs. |
| 6 | **Credit Report Parser** | `processing.credit-report-parser` | `text` (text, req) | `report` (creditReport) | `useAI` (boolean, default true) | Parses credit report text into a structured `CreditReport` object using `parseCreditReport()`. Optionally enables AI-enhanced parsing. |
| 7 | **Bureau Identifier** | `processing.bureau-identifier` | `text` (text, req) | `bureau` (text) | -- | Pattern-matching bureau detection using `identifyBureau()`. Returns `"Equifax"`, `"Experian"`, `"TransUnion"`, or `"Unknown"`. |
| 8 | **Page Number Deriver** | `processing.page-numbers` | `anchorIndex` (any, req), `totalPages` (any, req) | `pageNumbers` (any) | -- | Maps a character index in the full text to PDF page numbers using stored page offsets. Returns the anchor page plus up to 2 following pages. |
| 9 | **Equifax Summary Extractor** | `processing.equifax-summary` | `text` (text, req) | `summaryData` (any) | -- | Extracts structured summary fields (alerts, account age, credit history length) from Equifax reports using `extractReportSummaryWithAI()`. |
| 10 | **Equifax Summary Enhancer** | `processing.equifax-summary-enhance` | `text` (text, req), `existingSummary` (any, req) | `enhancedSummary` (any) | -- | Merges AI-extracted summary data with an existing summary object using `enhanceEquifaxSummaryWithAI()`. |
| 11 | **Debug Page Image Builder** | `processing.debug-images` | `pageNumbers` (any, req) | `debugPageImages` (any) | -- | Converts an array of PDF page numbers to base64 images for visual debugging. Deduplicates pages, skips invalid page numbers. |

---

### TRANSFORM (11 nodes)

| # | Name | Type String | Inputs | Outputs | Config | Purpose |
|---|------|-------------|--------|---------|--------|---------|
| 12 | **Data Mapper** | `transform.data-mapper` | `data` (any, req) | `mapped` (any) | `mapping` (textarea/JSON, req) | Restructures data using a JSON mapping object. Keys are new property names; values are source property names. |
| 13 | **Filter** | `transform.filter` | `data` (any, req) | `filtered` (any) | `condition` (text, req, e.g. `item.balance > 0`) | Filters array elements using a JavaScript condition expression. Non-array inputs pass through unchanged. |
| 14 | **Merge** | `transform.merge` | `input1` (any), `input2` (any), `input3` (any) | `merged` (any) | `strategy` (select: `object` or `array`) | Combines up to 3 inputs. Object strategy: `Object.assign`. Array strategy: concatenation. |
| 15 | **Whitespace Normalizer** | `transform.normalize-whitespace` | `text` (text, req) | `normalizedText` (text) | -- | Strips carriage return characters (`\r`) from text. Critical for cross-platform text consistency. |
| 16 | **Regex Escape** | `transform.escape-regex` | `text` (text, req) | `escapedText` (text) | -- | Escapes regex special characters (`.*+?^${}()\|[]\`) so text can be used safely in `RegExp` constructors. |
| 17 | **JSON Response Parser** | `transform.extract-json` | `responseText` (text, req) | `parsedJson` (any) | -- | Extracts JSON from AI responses. Tries markdown code blocks first, then falls back to finding the outermost `{...}` pair. |
| 18 | **Anchor Text Finder** | `transform.find-anchor` | `text` (text, req), `anchor` (text, req), `fallback` (text) | `anchorIndex` (any) | -- | Locates an anchor string within full text using flexible whitespace regex. Falls back to alternate anchor if primary not found. Returns character index. |
| 19 | **Account Snippet Builder** | `transform.account-snippet` | `text` (text, req), `anchorIndex` (any, req) | `snippet` (text) | `snippetPadding` (number, default 2200), `maxSnippetLength` (number, default 6500) | Extracts a text window around an anchor position. Window = `[anchor - padding, anchor + maxLength]`. Used to isolate account context for AI extraction. |
| 20 | **Debug Page Creator** | `transform.debug-pages` | `snippet` (text, req) | `debugPages` (any) | `pageCount` (number, default 3) | Splits a snippet into page-sized chunks for debug visualization. Tries form-feed splitting, then "Page N" labels, then even chunking. |
| 21 | **Page Boundary Splitter** | `transform.split-pages` | `text` (text, req) | `pages` (any) | `minPageCount` (number, default 3, range 1-1000) | Splits full text into pages by `\f` (form feed) characters or `Page N` labels. Falls back to single-page if neither delimiter yields enough pages. |
| 22 | **Prompt Template Parser** | `transform.parse-prompt-template` | `detectionTemplate` (text, req), `extractionTemplate` (text, req) | `parsedDetectionTemplate` (any), `parsedExtractionTemplate` (any), `errors` (any) | -- | Validates and parses JSON prompt template strings. Returns parsed objects and any parse errors. |

---

### AI / LLM (13 nodes)

| # | Name | Type String | Inputs | Outputs | Config | Purpose | Status |
|---|------|-------------|--------|---------|--------|---------|--------|
| 23 | **OpenAI Vision** | `ai.openai-vision` | `image` (image, req) | `result` (any) | `apiKey` (apikey, req), `prompt` (textarea, req), `model` (select: gpt-4o / gpt-4o-mini) | Analyze images with GPT-4 Vision. | **Phase 0 LOCKED** |
| 24 | **OpenAI API Caller** | `ai.openai-call` | `messages` (any, req), `apiKey` (text, req) | `responseText` (text) | `model` (text, default gpt-4o-mini), `temperature` (number, 0-2), `maxTokens` (number, 1-16000) | Generic OpenAI chat completion wrapper. | **Phase 0 LOCKED** |
| 25 | **OpenAI Table Extract** | `ai.openai-table-extract` | `image` (image, req) | `accounts` (accounts) | `apiKey` (apikey) | Extract tabular data from images using GPT-4 Vision. | **Phase 0 LOCKED** |
| 26 | **Tesseract OCR** | `ai.tesseract-ocr` | `image` (image, req) | `text` (text), `confidence` (any) | -- | Client-side OCR using Tesseract.js via `extractTextFromImageWithOCR()`. | Active |
| 27 | **Hugging Face NER** | `ai.huggingface-ner` | `text` (text, req) | `entities` (any) | -- | Named Entity Recognition (people, orgs, locations) using Transformers.js via `extractEntities()`. | Active |
| 28 | **Account Detection** | `ai.detect-accounts` | `text` (text, req) | `accountDetections` (any) | `customTemplate` (textarea), `accountResultLimit` (number, default 20) | Stage 1 of two-stage extraction: detects all accounts in text. | Stub |
| 29 | **Account Extraction** | `ai.account-extraction` | `report` (creditReport, req) | `accounts` (accounts), `logs` (any) | `detectionPrompt` (textarea/JSON), `extractionPrompt` (textarea/JSON) | High-level orchestrator that runs the full detect+extract pipeline via `extractAccountsFromReport()`. Supports custom prompt overrides. | Active |
| 30 | **Bureau Identifier AI** | `ai.identify-bureau-ai` | `text` (text, req) | `bureau` (any) | -- | AI-enhanced bureau detection using `identifyBureauWithAI()`. More accurate than pattern-matching for ambiguous reports. | Active |
| 31 | **Credit Report AI Parser** | `ai.parse-with-ai` | `text` (text, req) | `partialReport` (any) | -- | AI-first credit report parsing using `parseWithAI()`. Returns a partial structured report. | Active |
| 32 | **Credit Report AI Enhancer** | `ai.enhance-report` | `text` (text, req), `partialReport` (any, req) | `enhancedReport` (any) | -- | Enhances a partial report with NER-extracted personal information using `enhanceCreditReportWithAI()`. | Active |
| 33 | **Detection Prompt Builder** | `ai.build-detection-prompt` | `text` (text, req), `customTemplate` (any) | `messages` (any) | `accountLimit` (number, default 20, range 1-100) | Builds the OpenAI chat message array for account detection. Substitutes `{{TEXT}}` and `{{LIMIT}}` into the template. | Active |
| 34 | **Extraction Prompt Builder** | `ai.build-extraction-prompt` | `snippet` (text, req), `accountName` (text, req), `accountNumber` (text), `customTemplate` (any) | `messages` (any) | -- | Builds the OpenAI chat message array for single-account extraction. Substitutes `{{SNIPPET}}`, `{{ACCOUNT_NAME}}`, `{{ACCOUNT_NUMBER}}`. | Active |
| 35 | **Single Account Extractor** | `ai.extract-single-account` | `detection` (any, req), `rawText` (text, req) | `account` (any) | `customTemplate` (textarea) | Stage 2 of two-stage extraction: extracts detailed fields for one detected account. | Stub |

---

### OUTPUT (3 nodes)

| # | Name | Type String | Inputs | Outputs | Config | Purpose |
|---|------|-------------|--------|---------|--------|---------|
| 36 | **Display** | `output.display` | `data` (any, req) | -- (terminal) | `format` (select: json / table / custom) | Terminal node. Stores data for UI rendering in the results panel. |
| 37 | **Export** | `output.export` | `data` (any, req) | -- (terminal) | `format` (select: json / csv), `filename` (text, req) | Terminal node. Triggers a browser file download. JSON: pretty-printed. CSV: auto-generates headers from first object's keys. |
| 38 | **Webhook** | `output.webhook` | `data` (any, req) | `response` (any) | `url` (text, req), `method` (select: POST / PUT / PATCH) | Sends data as JSON to an external URL via `fetch()`. Returns the parsed JSON response. |

---

### CONTROL (4 nodes)

| # | Name | Type String | Inputs | Outputs | Config | Purpose |
|---|------|-------------|--------|---------|--------|---------|
| 39 | **Conditional** | `control.conditional` | `condition` (any, req), `trueInput` (any), `falseInput` (any) | `result` (any) | -- | Evaluates `Boolean(condition)`. If truthy, outputs `trueInput`; otherwise `falseInput`. |
| 40 | **Loop** | `control.loop` | `items` (any, req) | `results` (any) | `maxIterations` (number, default 100, range 1-1000) | Iterates over an array. Currently returns the array truncated to `maxIterations` (subgraph execution is planned but not yet implemented). |
| 41 | **API Key Validator** | `control.api-key-validator` | -- | `apiKey` (text), `isValid` (any) | `fallbackKey` (text) | Validates OpenAI API key from localStorage or fallback. | **Phase 0 LOCKED** -- always returns `{ apiKey: '', isValid: false }`. |
| 42 | **Account Error Handler** | `control.account-error-handler` | `error` (any, req), `accountName` (text, req), `defaultTemplate` (any) | `recoveredAccount` (any) | `createDefaultOnError` (checkbox, default true) | Gracefully handles extraction failures. When `createDefaultOnError` is true, creates a default account object with status `'ERROR'` and the error message in comments. |

---

## 10. Default Pipeline Templates

**File:** `src/features/node-editor/utils/defaultPipelines.ts` (1072 lines)

Four pre-built templates are exported:

| Template | Nodes | Edges | Description |
|----------|-------|-------|-------------|
| **Complete Backend Architecture (42 Nodes)** | 42 | 46 | Full pipeline showing every node type wired together across input, extraction, bureau identification, AI parsing, account detection loop, per-account extraction, AI enrichment, transformation, and output layers. |
| **Basic Credit Report Processing** | 4 | 3 | Minimal: PDF Upload -> Extract Text -> Parse Report -> Display. |
| **Full Credit Report Pipeline** | 5 | 4 | Basic + Account Extraction AI node before Display. |
| **Image OCR Pipeline** | 4 | 3 | PDF Upload -> PDF to Image -> Tesseract OCR -> Display. |

`getDefaultPipeline(name)` does a name-based lookup across these templates.

### Complete Backend Architecture -- Execution Layers

```
 x=100    x=450       x=850        x=1100-1350     x=1600    x=1850-2600    x=2850     x=3100    x=3350
 INPUT    EXTRACT     BUREAU ID    AI PARSE +       LOOP      PER-ACCOUNT    AI         DATA      OUTPUT
                                   EQUIFAX                    EXTRACTION     ENRICH     XFORM
 +------+ +--------+  +--------+   +----------+   +------+  +-----------+  +--------+ +--------+ +-------+
 |Upload| |ExtText |  |Bureau  |   |AI Parser |   | Loop |  |Anchor Find|  |Vision  | |Filter  | |Display|
 |Config| |Normalize|  |BureauAI|   |AI Enhance|   |      |  |Snippet    |  |Table   | |Mapper  | |Export |
 |Text  | |PdfToImg|  |        |   |Conditional|  |      |  |Prompt Bld |  |NER     | |Splitter| |Webhook|
 +------+ +--------+  +--------+   |EqfxSumm  |   +------+  |OpenAI Call|  |OCR     | |WsNorm  | +-------+
                                    |APIKeyVal  |             |JSON Parse |  +--------+ +--------+
                                    |DetectBld  |             |SingleAcct |
                                    |OpenAICal  |             |ErrHandler |
                                    |JSONParse  |             |Merge      |
                                    |AcctDetect |             +-----------+
                                    +----------+
```

---

## 11. Security Notes (Phase 0)

Three nodes are **permanently locked** in Phase 0 security mode. Their
`validate()` method always returns `{ valid: false, errors: ['Client-side provider calls are disabled in Phase 0.'] }` and their `execute()` throws:

```
Phase 0 security lock: node execution is disabled for client-side provider calls.
```

| Locked Node | Type String | Reason |
|-------------|-------------|--------|
| OpenAI Vision | `ai.openai-vision` | Direct client-side API call |
| OpenAI API Caller | `ai.openai-call` | Direct client-side API call |
| OpenAI Table Extract | `ai.openai-table-extract` | Direct client-side API call |
| API Key Validator | `control.api-key-validator` | Client-side key handling |

These nodes are present in the registry and canvas for architectural
visibility but cannot execute. The `AccountExtraction` node
(`ai.account-extraction`) uses a **server-side proxy** path via
`extractAccountsFromReport()` and is therefore NOT locked.

Two AI nodes (`AccountDetection` and `SingleAccountExtractor`) are
**stub implementations** that log warnings and return placeholder data.
They require actual backend integration to function.
