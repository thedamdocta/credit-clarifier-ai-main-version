import { useState, useEffect } from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import { nodeRegistry } from '../core/registry';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Settings, Code2, FileText, Info } from 'lucide-react';
import { ConfigField } from '../core/types';

// Helper to get implementation details from node
function getNodeImplementationDetails(nodeType: string): {
  sourceFile?: string;
  description?: string;
  promptTemplate?: string;
  backendFunction?: string;
  defaultSettings?: Record<string, any>;
  exampleInput?: string;
  exampleOutput?: string;
} {
  // Map node types to their implementation details
  const details: Record<string, any> = {
    // INPUT NODES
    'input.pdf-upload': {
      sourceFile: 'src/features/node-editor/nodes/input/PdfUploadNode.ts',
      description: 'Upload PDF credit report files for processing',
      backendFunction: 'File input - no backend processing',
      exampleOutput: 'File object + metadata',
    },
    'input.text-input': {
      sourceFile: 'src/features/node-editor/nodes/input/TextInputNode.ts',
      description: 'Manual text input for testing',
      backendFunction: 'Direct text passthrough',
      exampleOutput: 'Raw text string',
    },
    'input.config-source': {
      sourceFile: 'src/features/node-editor/nodes/input/ConfigSourceNode.ts',
      description: 'Provides API keys and configuration values',
      backendFunction: 'Reads from localStorage (openai-api-key)',
      exampleOutput: '{apiKey: "sk-..."}',
    },

    // PROCESSING NODES
    'processing.pdf-extract-text': {
      sourceFile: 'src/features/node-editor/nodes/processing/PdfExtractTextNode.ts',
      description: 'Extracts raw text from PDF using PDF.js',
      backendFunction: 'Uses extractTextFromPDF() from @/utils/pdf/extractText',
      exampleInput: 'PDF File object',
      exampleOutput: '{text: "...", pageCount: 15, pageOffsets: [...]}',
    },
    'processing.pdf-to-image': {
      sourceFile: 'src/features/node-editor/nodes/processing/PdfToImageNode.ts',
      description: 'Converts PDF pages to images for OCR/Vision AI',
      backendFunction: 'Uses convertPDFPageToImage() from @/utils/pdf/pdfToImage',
      defaultSettings: { pageNumber: 1, scale: 2 },
      exampleInput: 'PDF File, pageNumber',
      exampleOutput: 'Array of base64 image data URLs',
    },
    'processing.credit-report-parser': {
      sourceFile: 'src/features/node-editor/nodes/processing/CreditReportParserNode.ts',
      description: 'Parses credit report text into structured data',
      backendFunction: 'Uses parseCreditReport() from @/lib/parsers',
      defaultSettings: { useAI: true },
      exampleInput: 'Raw credit report text',
      exampleOutput: '{bureau: "Equifax", personalInfo: {...}, accounts: [...]}',
    },
    'processing.bureau-identifier': {
      sourceFile: 'src/features/node-editor/nodes/processing/BureauIdentifierNode.ts',
      description: 'Identifies credit bureau (Equifax/Experian/TransUnion) from text patterns',
      backendFunction: 'Uses identifyBureau() from @/lib/parsers',
      exampleInput: 'Credit report text',
      exampleOutput: '"Equifax" | "Experian" | "TransUnion"',
    },
    'processing.equifax-summary': {
      sourceFile: 'src/features/node-editor/nodes/processing/EquifaxSummaryExtractorNode.ts',
      description: 'Extracts structured summary from Equifax credit reports',
      backendFunction: 'Uses extractReportSummaryWithAI() from @/lib/ai/summaryExtraction',
      defaultSettings: { model: 'gpt-4o-mini' },
      exampleOutput: '{alertContacts: 5, avgAccountAge: "8 years", lengthOfCreditHistory: "15 years", ...}',
    },
    'processing.equifax-summary-enhance': {
      sourceFile: 'src/features/node-editor/nodes/processing/EquifaxSummaryEnhancerNode.ts',
      description: 'Enhances Equifax summary with AI-extracted additional fields',
      backendFunction: 'Uses enhanceEquifaxSummaryWithAI() from @/lib/ai/summaryExtraction',
      exampleInput: 'Existing summary object',
      exampleOutput: 'Enhanced summary with merged AI data',
    },
    'processing.page-numbers': {
      sourceFile: 'src/features/node-editor/nodes/processing/PageNumberDeriverNode.ts',
      description: 'Derives PDF page numbers from text anchor index',
      backendFunction: 'Uses getCurrentPdfPageOffsets() from @/utils/pdf/extractText',
      exampleInput: 'anchorIndex: 5420, totalPages: 15',
      exampleOutput: '[3, 4, 5] (anchor page + next 2 pages)',
    },
    'processing.debug-images': {
      sourceFile: 'src/features/node-editor/nodes/processing/DebugPageImageBuilderNode.ts',
      description: 'Converts PDF pages to base64 images for visual debugging',
      backendFunction: 'Uses convertPDFPageToImage() from @/utils/pdf/pdfToImage',
      exampleInput: 'pageNumbers: [1, 2, 3]',
      exampleOutput: 'Array of base64 image strings',
    },

    // AI NODES
    'ai.account-extraction': {
      sourceFile: 'src/features/node-editor/nodes/ai/AccountExtractionNode.ts',
      description: 'High-level account extraction orchestrator',
      backendFunction: 'Uses extractAccountsFromReport() from @/lib/ai/accountsExtraction',
      defaultSettings: { model: 'gpt-4o-mini', maxAccounts: 20 },
      exampleInput: 'Credit report object',
      exampleOutput: '{accounts: [...], logs: [...]}',
    },
    'ai.openai-vision': {
      sourceFile: 'src/features/node-editor/nodes/ai/OpenAIVisionNode.ts',
      description: 'Analyzes images with GPT-4 Vision',
      backendFunction: 'Uses OpenAI Vision API',
      defaultSettings: { model: 'gpt-4-vision-preview' },
      exampleInput: 'image (base64), prompt',
      exampleOutput: 'AI analysis of image content',
    },
    'ai.openai-table-extract': {
      sourceFile: 'src/features/node-editor/nodes/ai/OpenAITableExtractNode.ts',
      description: 'Extracts tables from images using GPT-4 Vision',
      backendFunction: 'Uses extractTableWithOpenAI() from @/lib/ai/visionExtraction',
      defaultSettings: { model: 'gpt-4-vision-preview' },
      exampleInput: 'Image with table data',
      exampleOutput: 'Structured table data as JSON',
    },
    'ai.huggingface-ner': {
      sourceFile: 'src/features/node-editor/nodes/ai/HuggingFaceNERNode.ts',
      description: 'Named Entity Recognition using Hugging Face Transformers.js',
      backendFunction: 'Uses extractEntities() from @/lib/ai/textAnalysis',
      exampleInput: 'Text string',
      exampleOutput: '[{entity: "PERSON", text: "John Doe", score: 0.98}, ...]',
    },
    'ai.tesseract-ocr': {
      sourceFile: 'src/features/node-editor/nodes/ai/TesseractOCRNode.ts',
      description: 'OCR text extraction from images using Tesseract.js',
      backendFunction: 'Uses extractTextFromImageWithOCR() from @/lib/ai/ocrExtraction',
      exampleInput: 'Image (base64 or URL)',
      exampleOutput: '{text: "...", confidence: 89.5}',
    },
    'ai.parse-with-ai': {
      sourceFile: 'src/features/node-editor/nodes/ai/CreditReportAIParserNode.ts',
      description: 'AI-first credit report parsing using GPT',
      backendFunction: 'Uses parseWithAI() from @/lib/ai/creditReportParsing',
      defaultSettings: { model: 'gpt-4o-mini' },
      exampleInput: 'Raw credit report text',
      exampleOutput: '{bureau: "...", reportDate: "...", personalInfo: {...}, rawText: "..."}',
    },
    'ai.enhance-report': {
      sourceFile: 'src/features/node-editor/nodes/ai/CreditReportAIEnhancerNode.ts',
      description: 'Enhances parsed report with AI-extracted entities',
      backendFunction: 'Uses enhanceCreditReportWithAI() from @/lib/ai/creditReportParsing',
      exampleInput: 'Partial credit report object',
      exampleOutput: 'Enhanced report with person names extracted',
    },
    'ai.detect-accounts': {
      sourceFile: 'src/features/node-editor/nodes/ai/AccountDetectionNode.ts',
      description: 'Stage 1: Detects all accounts in credit report',
      backendFunction: 'Uses detectAccounts() from @/lib/ai/accountsExtraction',
      defaultSettings: { accountResultLimit: 20 },
      exampleInput: 'Credit report text',
      exampleOutput: '[{accountName: "...", accountNumber: "...", anchorText: "..."}]',
    },
    'ai.extract-single-account': {
      sourceFile: 'src/features/node-editor/nodes/ai/SingleAccountExtractorNode.ts',
      description: 'Stage 2: Extracts detailed info for one account',
      backendFunction: 'Uses extractSingleAccount() from @/lib/ai/accountsExtraction',
      exampleInput: 'Account detection + raw text',
      exampleOutput: '{accountType: "...", balance: 5000, paymentStatus: "...", ...}',
    },
    'ai.identify-bureau-ai': {
      sourceFile: 'src/features/node-editor/nodes/ai/BureauIdentifierAINode.ts',
      description: 'AI-powered bureau identification (vs pattern matching)',
      backendFunction: 'Uses identifyBureauWithAI() from @/lib/ai/entityExtraction',
      exampleInput: 'Credit report text',
      exampleOutput: '"Equifax" | "Experian" | "TransUnion"',
    },
    'ai.openai-call': {
      sourceFile: 'src/features/node-editor/nodes/ai/OpenAICallerNode.ts',
      description: 'Makes API calls to OpenAI GPT models',
      backendFunction: 'Uses callOpenAI() from @/lib/ai/accountsExtraction',
      defaultSettings: {
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 2000,
      },
      exampleInput: 'messages: [{role: "user", content: "..."}]',
      exampleOutput: 'JSON string response from GPT',
    },
    'ai.build-detection-prompt': {
      sourceFile: 'src/features/node-editor/nodes/ai/DetectionPromptBuilderNode.ts',
      description: 'Builds the prompt for detecting all accounts in a credit report',
      promptTemplate: `You are a credit report analyzer. Extract ALL credit accounts from this report.

For each account, provide:
- accountName: Full creditor name
- accountNumber: Account number (last 4 digits if partially masked)
- anchorText: Unique text snippet to locate this account

Return up to {{LIMIT}} accounts as JSON array.

TEXT:
{{TEXT}}`,
      backendFunction: 'Uses DETECTION_PROMPT_TEMPLATE from @/lib/ai/accountsExtraction',
      defaultSettings: { accountLimit: 20, model: 'gpt-4o-mini', temperature: 0.2 },
      exampleInput: 'Credit report raw text',
      exampleOutput: '[{accountName: "Bank of America", accountNumber: "1234", anchorText: "..."}]',
    },
    'ai.build-extraction-prompt': {
      sourceFile: 'src/features/node-editor/nodes/ai/ExtractionPromptBuilderNode.ts',
      description: 'Builds the prompt for extracting detailed account information',
      promptTemplate: `Extract detailed information for this credit account:

Account: {{ACCOUNT_NAME}}
Account Number: {{ACCOUNT_NUMBER}}

From this text snippet:
{{SNIPPET}}

Extract:
- accountType, balance, paymentStatus, dateOpened, creditLimit, monthlyPayment, etc.

Return as JSON object.`,
      backendFunction: 'Uses EXTRACTION_PROMPT_TEMPLATE from @/lib/ai/accountsExtraction',
      defaultSettings: { model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 2000 },
      exampleInput: 'Text snippet + account name/number',
      exampleOutput: '{accountType: "Credit Card", balance: 5000, status: "Current", ...}',
    },

    // TRANSFORM NODES
    'transform.data-mapper': {
      sourceFile: 'src/features/node-editor/nodes/transform/DataMapperNode.ts',
      description: 'Maps/transforms data structure using JSONPath',
      backendFunction: 'Uses JSONPath expressions for mapping',
      exampleInput: '{accounts: [...]}',
      exampleOutput: 'Transformed data structure',
    },
    'transform.filter': {
      sourceFile: 'src/features/node-editor/nodes/transform/FilterNode.ts',
      description: 'Filters array items by condition',
      backendFunction: 'JavaScript eval() with condition',
      exampleInput: 'array + condition: "item.balance > 0"',
      exampleOutput: 'Filtered array',
    },
    'transform.merge': {
      sourceFile: 'src/features/node-editor/nodes/transform/MergeNode.ts',
      description: 'Merges multiple data sources',
      backendFunction: 'Object.assign() merge',
      exampleInput: 'input1 + input2',
      exampleOutput: 'Merged object',
    },
    'transform.account-snippet': {
      sourceFile: 'src/features/node-editor/nodes/transform/AccountSnippetBuilderNode.ts',
      description: 'Extracts text snippet around account location for focused parsing',
      backendFunction: 'Uses buildSnippet() logic from @/lib/ai/accountsExtraction',
      defaultSettings: { snippetPadding: 2200, maxSnippetLength: 6500 },
      exampleInput: 'text: "full credit report", anchorIndex: 5420',
      exampleOutput: 'Text snippet of ~6500 chars centered on account',
    },
    'transform.debug-pages': {
      sourceFile: 'src/features/node-editor/nodes/transform/DebugPageCreatorNode.ts',
      description: 'Splits snippet into debug page chunks',
      backendFunction: 'Uses createDebugPages() from @/lib/ai/accountsExtraction',
      defaultSettings: { pageCount: 3 },
      exampleInput: 'Text snippet',
      exampleOutput: '[page1, page2, page3]',
    },
    'transform.normalize-whitespace': {
      sourceFile: 'src/features/node-editor/nodes/transform/WhitespaceNormalizerNode.ts',
      description: 'Removes carriage returns and normalizes whitespace',
      backendFunction: 'text.replace(/\\r/g, "")',
      exampleInput: 'Text with \\r characters',
      exampleOutput: 'Normalized text',
    },
    'transform.escape-regex': {
      sourceFile: 'src/features/node-editor/nodes/transform/RegexEscapeNode.ts',
      description: 'Escapes special regex characters',
      backendFunction: 'text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")',
      exampleInput: 'Text with regex special chars',
      exampleOutput: 'Escaped text safe for regex',
    },
    'transform.find-anchor': {
      sourceFile: 'src/features/node-editor/nodes/transform/AnchorTextFinderNode.ts',
      description: 'Finds text position using fuzzy regex match',
      backendFunction: 'Uses findAnchorIndex() from @/lib/ai/accountsExtraction',
      exampleInput: 'text + anchor string',
      exampleOutput: 'Position index (number)',
    },
    'transform.parse-prompt-template': {
      sourceFile: 'src/features/node-editor/nodes/transform/PromptTemplateParserNode.ts',
      description: 'Parses and validates JSON prompt templates',
      backendFunction: 'JSON.parse() with error handling',
      exampleInput: 'JSON string template',
      exampleOutput: '{parsedTemplate, errors: []}',
    },
    'transform.extract-json': {
      sourceFile: 'src/features/node-editor/nodes/transform/JSONResponseParserNode.ts',
      description: 'Extracts JSON from markdown code blocks or raw text',
      backendFunction: 'Uses extractJsonFromResponse() from @/lib/ai/accountsExtraction',
      exampleInput: '```json\\n{...}\\n``` or raw JSON',
      exampleOutput: 'Parsed JSON object',
    },
    'transform.split-pages': {
      sourceFile: 'src/features/node-editor/nodes/transform/PageBoundarySplitterNode.ts',
      description: 'Splits text by page boundaries (\\f or "Page N" labels)',
      backendFunction: 'Uses splitOnPageBoundaries() from @/lib/ai/accountsExtraction',
      defaultSettings: { minPageCount: 3 },
      exampleInput: 'Multi-page text',
      exampleOutput: '[page1, page2, ...]',
    },

    // OUTPUT NODES
    'output.display': {
      sourceFile: 'src/features/node-editor/nodes/output/DisplayNode.ts',
      description: 'Displays results in UI preview',
      backendFunction: 'Renders data in display panel',
      exampleInput: 'Any data',
      exampleOutput: 'Visual display (no data output)',
    },
    'output.webhook': {
      sourceFile: 'src/features/node-editor/nodes/output/WebhookNode.ts',
      description: 'Sends data to external webhook URL',
      backendFunction: 'HTTP POST to configured URL',
      defaultSettings: { url: '', method: 'POST' },
      exampleInput: 'Any data',
      exampleOutput: 'HTTP response',
    },
    'output.export': {
      sourceFile: 'src/features/node-editor/nodes/output/ExportNode.ts',
      description: 'Exports data as JSON/CSV download',
      backendFunction: 'Creates downloadable file',
      defaultSettings: { format: 'json' },
      exampleInput: 'Any data',
      exampleOutput: 'Downloaded file',
    },

    // CONTROL NODES
    'control.conditional': {
      sourceFile: 'src/features/node-editor/nodes/control/ConditionalNode.ts',
      description: 'Routes data based on condition (if/else)',
      backendFunction: 'JavaScript eval() with condition',
      defaultSettings: { condition: 'data.value > 0' },
      exampleInput: 'data + condition',
      exampleOutput: 'Outputs to "true" or "false" port',
    },
    'control.loop': {
      sourceFile: 'src/features/node-editor/nodes/control/LoopNode.ts',
      description: 'Iterates over array items',
      backendFunction: 'for...of loop with executor',
      exampleInput: 'Array of items',
      exampleOutput: 'Outputs each item + index + final results array',
    },
    'control.api-key-validator': {
      sourceFile: 'src/features/node-editor/nodes/control/APIKeyValidatorNode.ts',
      description: 'Validates OpenAI API key format',
      backendFunction: 'Checks key format (sk-...)',
      exampleInput: 'API key string',
      exampleOutput: '{valid: true/false}',
    },
    'control.account-error-handler': {
      sourceFile: 'src/features/node-editor/nodes/control/AccountErrorHandlerNode.ts',
      description: 'Handles account extraction errors with fallback',
      backendFunction: 'Try/catch with default account creation',
      defaultSettings: { createDefaultOnError: true },
      exampleInput: 'Error object',
      exampleOutput: 'Default account or rethrow',
    },
  };

  return details[nodeType] || {};
}

export function PropertiesPanel() {
  const { selectedNodeId, nodes, updateNode, setNodes } = usePipelineStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const [localConfig, setLocalConfig] = useState<Record<string, any>>({});

  // Initialize local config when node is selected
  useEffect(() => {
    if (selectedNode) {
      setLocalConfig(selectedNode.data.config);
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Settings className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Select a node to view its properties</p>
      </div>
    );
  }

  const executor = nodeRegistry.getExecutor(selectedNode.data.type);
  const schema = executor.getConfigSchema();

  const handleConfigChange = (key: string, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);

    // Update node
    updateNode(selectedNode.id, {
      config: newConfig,
      inputs: executor.getInputPorts(newConfig),
      outputs: executor.getOutputPorts(newConfig),
    });
  };

  const handleLabelChange = (label: string) => {
    updateNode(selectedNode.id, { label });
  };

  const handleDeleteNode = () => {
    setNodes(nodes.filter((n) => n.id !== selectedNode.id));
  };

  const handleFileChange = (key: string, file: File | null) => {
    handleConfigChange(key, file);
  };

  const renderConfigField = (field: ConfigField) => {
    const value = localConfig[field.key] ?? field.defaultValue;

    switch (field.type) {
      case 'text':
      case 'apikey':
        return (
          <Input
            type={field.type === 'apikey' ? 'password' : 'text'}
            value={value || ''}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value ?? ''}
            onChange={(e) => handleConfigChange(field.key, parseFloat(e.target.value))}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
          />
        );

      case 'boolean':
        return (
          <Switch
            checked={value ?? false}
            onCheckedChange={(checked) => handleConfigChange(field.key, checked)}
          />
        );

      case 'select':
        return (
          <Select value={value} onValueChange={(v) => handleConfigChange(field.key, v)}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
          />
        );

      case 'file':
        return (
          <div>
            <Input
              type="file"
              onChange={(e) => handleFileChange(field.key, e.target.files?.[0] || null)}
              accept=".pdf"
            />
            {value && (
              <div className="text-xs text-muted-foreground mt-1">
                Selected: {value.name}
              </div>
            )}
          </div>
        );

      default:
        return <div className="text-xs text-muted-foreground">Unknown field type</div>;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Node Properties</h3>
        <p className="text-xs text-muted-foreground">{selectedNode.data.type}</p>
      </div>

      <Separator />

      {/* Node Label */}
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={selectedNode.data.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Node label"
        />
      </div>

      {/* Configuration Fields */}
      {schema.fields.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <h4 className="font-medium">Configuration</h4>
            {schema.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {renderConfigField(field)}
                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Inputs */}
      <Separator />
      <div className="space-y-2">
        <h4 className="font-medium">Inputs</h4>
        {selectedNode.data.inputs.length > 0 ? (
          <div className="space-y-1">
            {selectedNode.data.inputs.map((input) => (
              <div key={input.id} className="text-sm flex items-center justify-between">
                <span>{input.label}</span>
                <span className="text-xs text-muted-foreground">
                  {input.dataType}
                  {input.required && <span className="text-red-500 ml-1">*</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No inputs</p>
        )}
      </div>

      {/* Outputs */}
      <Separator />
      <div className="space-y-2">
        <h4 className="font-medium">Outputs</h4>
        {selectedNode.data.outputs.length > 0 ? (
          <div className="space-y-1">
            {selectedNode.data.outputs.map((output) => (
              <div key={output.id} className="text-sm flex items-center justify-between">
                <span>{output.label}</span>
                <span className="text-xs text-muted-foreground">{output.dataType}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No outputs</p>
        )}
      </div>

      {/* Status */}
      {selectedNode.data.status && selectedNode.data.status !== 'idle' && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium">Status</h4>
            <div className="text-sm">
              <span className="capitalize">{selectedNode.data.status}</span>
            </div>
            {selectedNode.data.error && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {selectedNode.data.error}
              </div>
            )}
          </div>
        </>
      )}

      {/* Implementation Details Tabs */}
      <Separator />
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">
            <Info className="w-4 h-4 mr-1" />
            Info
          </TabsTrigger>
          <TabsTrigger value="prompt">
            <FileText className="w-4 h-4 mr-1" />
            Prompt
          </TabsTrigger>
          <TabsTrigger value="code">
            <Code2 className="w-4 h-4 mr-1" />
            Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-3 mt-3">
          {(() => {
            const details = getNodeImplementationDetails(selectedNode.data.type);
            return (
              <>
                {details.description && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Description</h5>
                    <p className="text-xs text-muted-foreground">{details.description}</p>
                  </div>
                )}
                {details.sourceFile && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Source File</h5>
                    <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                      {details.sourceFile}
                    </code>
                  </div>
                )}
                {details.backendFunction && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Backend Function</h5>
                    <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                      {details.backendFunction}
                    </code>
                  </div>
                )}
                {details.defaultSettings && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Default Settings</h5>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(details.defaultSettings, null, 2)}
                    </pre>
                  </div>
                )}
                {details.exampleInput && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Example Input</h5>
                    <code className="text-xs bg-muted p-2 rounded block">{details.exampleInput}</code>
                  </div>
                )}
                {details.exampleOutput && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Example Output</h5>
                    <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                      {details.exampleOutput}
                    </code>
                  </div>
                )}
                {!details.description && (
                  <p className="text-xs text-muted-foreground italic">
                    No implementation details available for this node type.
                  </p>
                )}
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="prompt" className="mt-3">
          {(() => {
            const details = getNodeImplementationDetails(selectedNode.data.type);
            return details.promptTemplate ? (
              <div>
                <h5 className="text-sm font-medium mb-2">Prompt Template</h5>
                <Textarea
                  value={details.promptTemplate}
                  readOnly
                  className="font-mono text-xs h-64"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Variables like {`{{TEXT}}`}, {`{{LIMIT}}`} are replaced at runtime
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                This node does not use AI prompts.
              </p>
            );
          })()}
        </TabsContent>

        <TabsContent value="code" className="mt-3">
          {(() => {
            const details = getNodeImplementationDetails(selectedNode.data.type);
            return details.sourceFile ? (
              <div>
                <h5 className="text-sm font-medium mb-2">Implementation Location</h5>
                <code className="text-xs bg-muted p-2 rounded block mb-3">
                  {details.sourceFile}
                </code>
                <p className="text-xs text-muted-foreground">
                  Open this file to view/edit the node's execute() function.
                </p>
                {details.backendFunction && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium mb-1">Calls Backend Function</h5>
                    <code className="text-xs bg-muted p-2 rounded block">
                      {details.backendFunction}
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No code reference available.
              </p>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Delete Button */}
      <Separator />
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDeleteNode}
        className="w-full"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete Node
      </Button>
    </div>
  );
}
