import { PipelineDefinition } from '../core/types';
import { generatePipelineId } from '../core/serialization';

/**
 * Default pipeline templates
 */

export const COMPLETE_BACKEND_PIPELINE: PipelineDefinition = {
  id: generatePipelineId(),
  name: 'Complete Backend Architecture (42 Nodes)',
  description: 'Comprehensive pipeline showing all 42 nodes in the complete backend architecture',
  nodes: [
    // INPUT LAYER (x: 100) - Spread vertically with 250px spacing
    {
      id: 'node_pdf_upload',
      type: 'custom',
      position: { x: 100, y: 100 },
      data: {
        label: 'PDF Upload',
        type: 'input.pdf-upload',
        category: 'input',
        config: {},
        inputs: [],
        outputs: [
          { id: 'file', label: 'file', dataType: 'file', required: false },
          { id: 'metadata', label: 'metadata', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_config_source',
      type: 'custom',
      position: { x: 100, y: 350 },
      data: {
        label: 'Config Source',
        type: 'input.config-source',
        category: 'input',
        config: {},
        inputs: [],
        outputs: [{ id: 'config', label: 'config', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_text_input',
      type: 'custom',
      position: { x: 100, y: 600 },
      data: {
        label: 'Text Input',
        type: 'input.text-input',
        category: 'input',
        config: {},
        inputs: [],
        outputs: [{ id: 'text', label: 'text', dataType: 'text', required: false }],
        status: 'idle',
      },
    },

    // EXTRACTION LAYER (x: 450) - Increase horizontal and vertical spacing
    {
      id: 'node_extract_text',
      type: 'custom',
      position: { x: 450, y: 100 },
      data: {
        label: 'Extract Text',
        type: 'processing.pdf-extract-text',
        category: 'processing',
        config: {},
        inputs: [{ id: 'file', label: 'file', dataType: 'file', required: true }],
        outputs: [
          { id: 'text', label: 'text', dataType: 'text', required: false },
          { id: 'pageCount', label: 'pageCount', dataType: 'any', required: false },
          { id: 'pageOffsets', label: 'pageOffsets', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_normalize_whitespace',
      type: 'custom',
      position: { x: 450, y: 350 },
      data: {
        label: 'Normalize Whitespace',
        type: 'transform.normalize-whitespace',
        category: 'transform',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'normalizedText', label: 'normalizedText', dataType: 'text', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_pdf_to_image',
      type: 'custom',
      position: { x: 450, y: 600 },
      data: {
        label: 'PDF to Image',
        type: 'processing.pdf-to-image',
        category: 'processing',
        config: { pageNumber: 1, scale: 2 },
        inputs: [{ id: 'file', label: 'file', dataType: 'file', required: true }],
        outputs: [{ id: 'images', label: 'images', dataType: 'any', required: false }],
        status: 'idle',
      },
    },

    // BUREAU IDENTIFICATION (x: 850) - Parallel paths staggered
    {
      id: 'node_bureau_identifier',
      type: 'custom',
      position: { x: 850, y: 200 },
      data: {
        label: 'Bureau Identifier',
        type: 'processing.bureau-identifier',
        category: 'processing',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'bureau', label: 'bureau', dataType: 'text', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_bureau_identifier_ai',
      type: 'custom',
      position: { x: 850, y: 450 },
      data: {
        label: 'Bureau Identifier AI',
        type: 'ai.identify-bureau-ai',
        category: 'ai',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'bureau', label: 'bureau', dataType: 'text', required: false }],
        status: 'idle',
      },
    },

    // AI PARSING LAYER (x: 1250) - Tree branching
    {
      id: 'node_credit_report_ai_parser',
      type: 'custom',
      position: { x: 1250, y: 150 },
      data: {
        label: 'Credit Report AI Parser',
        type: 'ai.parse-with-ai',
        category: 'ai',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'report', label: 'report', dataType: 'creditReport', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_credit_report_ai_enhancer',
      type: 'custom',
      position: { x: 1250, y: 400 },
      data: {
        label: 'Credit Report AI Enhancer',
        type: 'ai.enhance-report',
        category: 'ai',
        config: {},
        inputs: [{ id: 'report', label: 'report', dataType: 'creditReport', required: true }],
        outputs: [{ id: 'enhancedReport', label: 'enhancedReport', dataType: 'creditReport', required: false }],
        status: 'idle',
      },
    },

    // BUREAU-SPECIFIC PROCESSING (x: 1100)
    {
      id: 'node_conditional',
      type: 'custom',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Conditional',
        type: 'control.conditional',
        category: 'control-flow',
        config: { condition: 'bureau === "Equifax"' },
        inputs: [
          { id: 'data', label: 'data', dataType: 'any', required: true },
          { id: 'condition', label: 'condition', dataType: 'any', required: true },
        ],
        outputs: [
          { id: 'true', label: 'true', dataType: 'any', required: false },
          { id: 'false', label: 'false', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_equifax_summary_extractor',
      type: 'custom',
      position: { x: 1100, y: 100 },
      data: {
        label: 'Equifax Summary Extractor',
        type: 'processing.equifax-summary',
        category: 'processing',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'summary', label: 'summary', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_equifax_summary_enhancer',
      type: 'custom',
      position: { x: 1100, y: 150 },
      data: {
        label: 'Equifax Summary Enhancer',
        type: 'processing.equifax-summary-enhance',
        category: 'processing',
        config: {},
        inputs: [{ id: 'summary', label: 'summary', dataType: 'any', required: true }],
        outputs: [{ id: 'enhancedSummary', label: 'enhancedSummary', dataType: 'any', required: false }],
        status: 'idle',
      },
    },

    // ACCOUNT DETECTION STAGE (x: 1350)
    {
      id: 'node_api_key_validator',
      type: 'custom',
      position: { x: 1350, y: 400 },
      data: {
        label: 'API Key Validator',
        type: 'control.api-key-validator',
        category: 'utility',
        config: {},
        inputs: [{ id: 'apiKey', label: 'apiKey', dataType: 'text', required: true }],
        outputs: [{ id: 'valid', label: 'valid', dataType: 'boolean', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_detection_prompt_builder',
      type: 'custom',
      position: { x: 1350, y: 200 },
      data: {
        label: 'Detection Prompt Builder',
        type: 'ai.build-detection-prompt',
        category: 'ai',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'prompt', label: 'prompt', dataType: 'text', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_openai_caller_detection',
      type: 'custom',
      position: { x: 1350, y: 250 },
      data: {
        label: 'OpenAI Caller (Detection)',
        type: 'ai.openai-call',
        category: 'ai',
        config: { model: 'gpt-4' },
        inputs: [
          { id: 'prompt', label: 'prompt', dataType: 'text', required: true },
          { id: 'apiKey', label: 'apiKey', dataType: 'text', required: true },
        ],
        outputs: [{ id: 'response', label: 'response', dataType: 'text', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_json_response_parser_detection',
      type: 'custom',
      position: { x: 1350, y: 300 },
      data: {
        label: 'JSON Response Parser (Detection)',
        type: 'transform.extract-json',
        category: 'processing',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'data', label: 'data', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_account_detection',
      type: 'custom',
      position: { x: 1350, y: 350 },
      data: {
        label: 'Account Detection',
        type: 'ai.account-detection',
        category: 'ai',
        config: {},
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [{ id: 'accounts', label: 'accounts', dataType: 'array', required: false }],
        status: 'idle',
      },
    },

    // LOOP FOR EACH ACCOUNT (x: 1600)
    {
      id: 'node_loop',
      type: 'custom',
      position: { x: 1600, y: 300 },
      data: {
        label: 'Loop',
        type: 'control.loop',
        category: 'control-flow',
        config: {},
        inputs: [{ id: 'items', label: 'items', dataType: 'array', required: true }],
        outputs: [
          { id: 'item', label: 'item', dataType: 'any', required: false },
          { id: 'index', label: 'index', dataType: 'number', required: false },
          { id: 'results', label: 'results', dataType: 'array', required: false },
        ],
        status: 'idle',
      },
    },

    // ACCOUNT EXTRACTION PER ITEM (x: 1850-2600)
    {
      id: 'node_regex_escape',
      type: 'custom',
      position: { x: 1850, y: 200 },
      data: {
        label: 'Regex Escape',
        type: 'transform.escape-regex',
        category: 'utility',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'escapedText', label: 'escapedText', dataType: 'text', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_anchor_text_finder',
      type: 'custom',
      position: { x: 1850, y: 250 },
      data: {
        label: 'Anchor Text Finder',
        type: 'transform.find-anchor',
        category: 'processing',
        config: {},
        inputs: [
          { id: 'text', label: 'text', dataType: 'text', required: true },
          { id: 'anchor', label: 'anchor', dataType: 'text', required: true },
        ],
        outputs: [{ id: 'position', label: 'position', dataType: 'number', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_account_snippet_builder',
      type: 'custom',
      position: { x: 2100, y: 300 },
      data: {
        label: 'Account Snippet Builder',
        type: 'transform.account-snippet',
        category: 'processing',
        config: {},
        inputs: [
          { id: 'text', label: 'text', dataType: 'text', required: true },
          { id: 'position', label: 'position', dataType: 'number', required: true },
        ],
        outputs: [{ id: 'snippet', label: 'snippet', dataType: 'text', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_debug_page_creator',
      type: 'custom',
      position: { x: 2100, y: 200 },
      data: {
        label: 'Debug Page Creator',
        type: 'transform.debug-pages',
        category: 'utility',
        config: {},
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [{ id: 'page', label: 'page', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_page_number_deriver',
      type: 'custom',
      position: { x: 2100, y: 250 },
      data: {
        label: 'Page Number Deriver',
        type: 'processing.page-numbers',
        category: 'processing',
        config: {},
        inputs: [
          { id: 'position', label: 'position', dataType: 'number', required: true },
          { id: 'pageOffsets', label: 'pageOffsets', dataType: 'any', required: true },
        ],
        outputs: [{ id: 'pageNumber', label: 'pageNumber', dataType: 'number', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_debug_page_image_builder',
      type: 'custom',
      position: { x: 2350, y: 300 },
      data: {
        label: 'Debug Page Image Builder',
        type: 'processing.debug-images',
        category: 'processing',
        config: {},
        inputs: [
          { id: 'images', label: 'images', dataType: 'any', required: true },
          { id: 'pageNumber', label: 'pageNumber', dataType: 'number', required: true },
        ],
        outputs: [{ id: 'image', label: 'image', dataType: 'image', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_extraction_prompt_builder',
      type: 'custom',
      position: { x: 2350, y: 350 },
      data: {
        label: 'Extraction Prompt Builder',
        type: 'ai.build-extraction-prompt',
        category: 'ai',
        config: {},
        inputs: [{ id: 'snippet', label: 'snippet', dataType: 'text', required: true }],
        outputs: [{ id: 'prompt', label: 'prompt', dataType: 'text', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_openai_caller_extraction',
      type: 'custom',
      position: { x: 2350, y: 400 },
      data: {
        label: 'OpenAI Caller (Extraction)',
        type: 'ai.openai-call',
        category: 'ai',
        config: { model: 'gpt-4' },
        inputs: [
          { id: 'prompt', label: 'prompt', dataType: 'text', required: true },
          { id: 'apiKey', label: 'apiKey', dataType: 'text', required: true },
        ],
        outputs: [{ id: 'response', label: 'response', dataType: 'text', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_json_response_parser_extraction',
      type: 'custom',
      position: { x: 2350, y: 450 },
      data: {
        label: 'JSON Response Parser (Extraction)',
        type: 'transform.extract-json',
        category: 'processing',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'data', label: 'data', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_single_account_extractor',
      type: 'custom',
      position: { x: 2600, y: 500 },
      data: {
        label: 'Single Account Extractor',
        type: 'ai.extract-single-account',
        category: 'processing',
        config: {},
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [{ id: 'account', label: 'account', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_account_error_handler',
      type: 'custom',
      position: { x: 2600, y: 550 },
      data: {
        label: 'Account Error Handler',
        type: 'control.account-error-handler',
        category: 'control-flow',
        config: {},
        inputs: [{ id: 'error', label: 'error', dataType: 'any', required: true }],
        outputs: [{ id: 'handled', label: 'handled', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_merge',
      type: 'custom',
      position: { x: 2600, y: 600 },
      data: {
        label: 'Merge',
        type: 'transform.merge',
        category: 'control-flow',
        config: {},
        inputs: [
          { id: 'input1', label: 'input1', dataType: 'any', required: true },
          { id: 'input2', label: 'input2', dataType: 'any', required: false },
        ],
        outputs: [{ id: 'output', label: 'output', dataType: 'any', required: false }],
        status: 'idle',
      },
    },

    // AI ENRICHMENT (x: 2850, parallel paths from PDF to Image)
    {
      id: 'node_openai_vision',
      type: 'custom',
      position: { x: 2850, y: 100 },
      data: {
        label: 'OpenAI Vision',
        type: 'ai.openai-vision',
        category: 'ai',
        config: {},
        inputs: [
          { id: 'image', label: 'image', dataType: 'image', required: true },
          { id: 'prompt', label: 'prompt', dataType: 'text', required: true },
        ],
        outputs: [{ id: 'analysis', label: 'analysis', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_openai_table_extract',
      type: 'custom',
      position: { x: 2850, y: 200 },
      data: {
        label: 'OpenAI Table Extract',
        type: 'ai.openai-table-extract',
        category: 'ai',
        config: {},
        inputs: [{ id: 'image', label: 'image', dataType: 'image', required: true }],
        outputs: [{ id: 'table', label: 'table', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_hugging_face_ner',
      type: 'custom',
      position: { x: 2850, y: 300 },
      data: {
        label: 'Hugging Face NER',
        type: 'ai.huggingface-ner',
        category: 'ai',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'entities', label: 'entities', dataType: 'array', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_tesseract_ocr',
      type: 'custom',
      position: { x: 2850, y: 400 },
      data: {
        label: 'Tesseract OCR',
        type: 'ai.tesseract-ocr',
        category: 'ai',
        config: {},
        inputs: [{ id: 'image', label: 'image', dataType: 'image', required: true }],
        outputs: [
          { id: 'text', label: 'text', dataType: 'text', required: false },
          { id: 'confidence', label: 'confidence', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },

    // DATA TRANSFORMATION (x: 3100)
    {
      id: 'node_filter',
      type: 'custom',
      position: { x: 3100, y: 300 },
      data: {
        label: 'Filter',
        type: 'transform.filter',
        category: 'processing',
        config: {},
        inputs: [
          { id: 'data', label: 'data', dataType: 'array', required: true },
          { id: 'condition', label: 'condition', dataType: 'any', required: true },
        ],
        outputs: [{ id: 'filtered', label: 'filtered', dataType: 'array', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_data_mapper',
      type: 'custom',
      position: { x: 3100, y: 400 },
      data: {
        label: 'Data Mapper',
        type: 'transform.data-mapper',
        category: 'processing',
        config: {},
        inputs: [
          { id: 'data', label: 'data', dataType: 'any', required: true },
          { id: 'mapping', label: 'mapping', dataType: 'any', required: true },
        ],
        outputs: [{ id: 'mapped', label: 'mapped', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_page_boundary_splitter',
      type: 'custom',
      position: { x: 3100, y: 500 },
      data: {
        label: 'Page Boundary Splitter',
        type: 'transform.split-pages',
        category: 'processing',
        config: {},
        inputs: [
          { id: 'text', label: 'text', dataType: 'text', required: true },
          { id: 'pageOffsets', label: 'pageOffsets', dataType: 'any', required: true },
        ],
        outputs: [{ id: 'pages', label: 'pages', dataType: 'array', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_whitespace_normalizer',
      type: 'custom',
      position: { x: 3100, y: 600 },
      data: {
        label: 'Whitespace Normalizer',
        type: 'transform.normalize-whitespace',
        category: 'utility',
        config: {},
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'normalized', label: 'normalized', dataType: 'text', required: false }],
        status: 'idle',
      },
    },

    // OUTPUT LAYER (x: 3350)
    {
      id: 'node_display',
      type: 'custom',
      position: { x: 3350, y: 300 },
      data: {
        label: 'Display',
        type: 'output.display',
        category: 'output',
        config: { format: 'json' },
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [],
        status: 'idle',
      },
    },
    {
      id: 'node_export',
      type: 'custom',
      position: { x: 3350, y: 400 },
      data: {
        label: 'Export',
        type: 'output.export',
        category: 'output',
        config: { format: 'json' },
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [],
        status: 'idle',
      },
    },
    {
      id: 'node_webhook',
      type: 'custom',
      position: { x: 3350, y: 500 },
      data: {
        label: 'Webhook',
        type: 'output.webhook',
        category: 'output',
        config: { url: '' },
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [],
        status: 'idle',
      },
    },
  ],
  edges: [
    // INPUT → EXTRACTION LAYER
    { id: 'edge1', source: 'node_pdf_upload', sourceHandle: 'file', target: 'node_extract_text', targetHandle: 'file' },
    { id: 'edge2', source: 'node_extract_text', sourceHandle: 'text', target: 'node_normalize_whitespace', targetHandle: 'text' },
    { id: 'edge3', source: 'node_pdf_upload', sourceHandle: 'file', target: 'node_pdf_to_image', targetHandle: 'file' },

    // EXTRACTION → BUREAU IDENTIFICATION
    { id: 'edge4', source: 'node_normalize_whitespace', sourceHandle: 'normalizedText', target: 'node_bureau_identifier', targetHandle: 'text' },
    { id: 'edge5', source: 'node_normalize_whitespace', sourceHandle: 'normalizedText', target: 'node_bureau_identifier_ai', targetHandle: 'text' },

    // NORMALIZE → AI PARSING
    { id: 'edge6', source: 'node_normalize_whitespace', sourceHandle: 'normalizedText', target: 'node_credit_report_ai_parser', targetHandle: 'text' },
    { id: 'edge7', source: 'node_credit_report_ai_parser', sourceHandle: 'report', target: 'node_credit_report_ai_enhancer', targetHandle: 'report' },

    // AI PARSING → CONDITIONAL
    { id: 'edge8', source: 'node_credit_report_ai_enhancer', sourceHandle: 'enhancedReport', target: 'node_conditional', targetHandle: 'data' },
    { id: 'edge9', source: 'node_bureau_identifier', sourceHandle: 'bureau', target: 'node_conditional', targetHandle: 'condition' },

    // CONDITIONAL → EQUIFAX PROCESSING
    { id: 'edge10', source: 'node_conditional', sourceHandle: 'true', target: 'node_equifax_summary_extractor', targetHandle: 'text' },
    { id: 'edge11', source: 'node_equifax_summary_extractor', sourceHandle: 'summary', target: 'node_equifax_summary_enhancer', targetHandle: 'summary' },

    // ACCOUNT DETECTION STAGE
    { id: 'edge12', source: 'node_config_source', sourceHandle: 'config', target: 'node_api_key_validator', targetHandle: 'apiKey' },
    { id: 'edge13', source: 'node_normalize_whitespace', sourceHandle: 'normalizedText', target: 'node_detection_prompt_builder', targetHandle: 'text' },
    { id: 'edge14', source: 'node_detection_prompt_builder', sourceHandle: 'prompt', target: 'node_openai_caller_detection', targetHandle: 'prompt' },
    { id: 'edge15', source: 'node_api_key_validator', sourceHandle: 'valid', target: 'node_openai_caller_detection', targetHandle: 'apiKey' },
    { id: 'edge16', source: 'node_openai_caller_detection', sourceHandle: 'response', target: 'node_json_response_parser_detection', targetHandle: 'text' },
    { id: 'edge17', source: 'node_json_response_parser_detection', sourceHandle: 'data', target: 'node_account_detection', targetHandle: 'data' },

    // LOOP SETUP
    { id: 'edge18', source: 'node_account_detection', sourceHandle: 'accounts', target: 'node_loop', targetHandle: 'items' },

    // LOOP BODY - ACCOUNT EXTRACTION
    { id: 'edge19', source: 'node_loop', sourceHandle: 'item', target: 'node_regex_escape', targetHandle: 'text' },
    { id: 'edge20', source: 'node_regex_escape', sourceHandle: 'escapedText', target: 'node_anchor_text_finder', targetHandle: 'anchor' },
    { id: 'edge21', source: 'node_normalize_whitespace', sourceHandle: 'normalizedText', target: 'node_anchor_text_finder', targetHandle: 'text' },
    { id: 'edge22', source: 'node_anchor_text_finder', sourceHandle: 'position', target: 'node_account_snippet_builder', targetHandle: 'position' },
    { id: 'edge23', source: 'node_normalize_whitespace', sourceHandle: 'normalizedText', target: 'node_account_snippet_builder', targetHandle: 'text' },

    // DEBUG PARALLEL PATH
    { id: 'edge24', source: 'node_loop', sourceHandle: 'item', target: 'node_debug_page_creator', targetHandle: 'data' },
    { id: 'edge25', source: 'node_anchor_text_finder', sourceHandle: 'position', target: 'node_page_number_deriver', targetHandle: 'position' },
    { id: 'edge26', source: 'node_extract_text', sourceHandle: 'pageOffsets', target: 'node_page_number_deriver', targetHandle: 'pageOffsets' },
    { id: 'edge27', source: 'node_page_number_deriver', sourceHandle: 'pageNumber', target: 'node_debug_page_image_builder', targetHandle: 'pageNumber' },
    { id: 'edge28', source: 'node_pdf_to_image', sourceHandle: 'images', target: 'node_debug_page_image_builder', targetHandle: 'images' },

    // EXTRACTION PROMPT & OPENAI
    { id: 'edge29', source: 'node_account_snippet_builder', sourceHandle: 'snippet', target: 'node_extraction_prompt_builder', targetHandle: 'snippet' },
    { id: 'edge30', source: 'node_extraction_prompt_builder', sourceHandle: 'prompt', target: 'node_openai_caller_extraction', targetHandle: 'prompt' },
    { id: 'edge31', source: 'node_api_key_validator', sourceHandle: 'valid', target: 'node_openai_caller_extraction', targetHandle: 'apiKey' },
    { id: 'edge32', source: 'node_openai_caller_extraction', sourceHandle: 'response', target: 'node_json_response_parser_extraction', targetHandle: 'text' },
    { id: 'edge33', source: 'node_json_response_parser_extraction', sourceHandle: 'data', target: 'node_single_account_extractor', targetHandle: 'data' },

    // ERROR HANDLING & MERGE
    { id: 'edge34', source: 'node_single_account_extractor', sourceHandle: 'account', target: 'node_merge', targetHandle: 'input1' },
    { id: 'edge35', source: 'node_account_error_handler', sourceHandle: 'handled', target: 'node_merge', targetHandle: 'input2' },

    // AI ENRICHMENT PATHS (parallel from PDF to Image)
    { id: 'edge36', source: 'node_pdf_to_image', sourceHandle: 'images', target: 'node_openai_vision', targetHandle: 'image' },
    { id: 'edge37', source: 'node_pdf_to_image', sourceHandle: 'images', target: 'node_openai_table_extract', targetHandle: 'image' },
    { id: 'edge38', source: 'node_normalize_whitespace', sourceHandle: 'normalizedText', target: 'node_hugging_face_ner', targetHandle: 'text' },
    { id: 'edge39', source: 'node_pdf_to_image', sourceHandle: 'images', target: 'node_tesseract_ocr', targetHandle: 'image' },

    // DATA TRANSFORMATION
    { id: 'edge40', source: 'node_loop', sourceHandle: 'results', target: 'node_filter', targetHandle: 'data' },
    { id: 'edge41', source: 'node_filter', sourceHandle: 'filtered', target: 'node_data_mapper', targetHandle: 'data' },
    { id: 'edge42', source: 'node_extract_text', sourceHandle: 'pageOffsets', target: 'node_page_boundary_splitter', targetHandle: 'pageOffsets' },
    { id: 'edge43', source: 'node_extract_text', sourceHandle: 'text', target: 'node_whitespace_normalizer', targetHandle: 'text' },

    // OUTPUTS
    { id: 'edge44', source: 'node_data_mapper', sourceHandle: 'mapped', target: 'node_display', targetHandle: 'data' },
    { id: 'edge45', source: 'node_data_mapper', sourceHandle: 'mapped', target: 'node_export', targetHandle: 'data' },
    { id: 'edge46', source: 'node_data_mapper', sourceHandle: 'mapped', target: 'node_webhook', targetHandle: 'data' },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const BASIC_CREDIT_REPORT_PIPELINE: PipelineDefinition = {
  id: generatePipelineId(),
  name: 'Basic Credit Report Processing',
  description: 'Simple pipeline: PDF → Extract Text → Parse → Display',
  nodes: [
    {
      id: 'node_upload',
      type: 'custom',
      position: { x: 100, y: 200 },
      data: {
        label: 'PDF Upload',
        type: 'input.pdf-upload',
        category: 'input',
        config: {},
        inputs: [],
        outputs: [
          { id: 'file', label: 'file', dataType: 'file', required: false },
          { id: 'metadata', label: 'metadata', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_extract',
      type: 'custom',
      position: { x: 350, y: 200 },
      data: {
        label: 'Extract Text',
        type: 'processing.pdf-extract-text',
        category: 'processing',
        config: {},
        inputs: [{ id: 'file', label: 'file', dataType: 'file', required: true }],
        outputs: [
          { id: 'text', label: 'text', dataType: 'text', required: false },
          { id: 'pageCount', label: 'pageCount', dataType: 'any', required: false },
          { id: 'pageOffsets', label: 'pageOffsets', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_parse',
      type: 'custom',
      position: { x: 600, y: 200 },
      data: {
        label: 'Parse Report',
        type: 'processing.credit-report-parser',
        category: 'processing',
        config: { useAI: true },
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'report', label: 'report', dataType: 'creditReport', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_display',
      type: 'custom',
      position: { x: 850, y: 200 },
      data: {
        label: 'Display',
        type: 'output.display',
        category: 'output',
        config: { format: 'json' },
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [],
        status: 'idle',
      },
    },
  ],
  edges: [
    {
      id: 'edge1',
      source: 'node_upload',
      sourceHandle: 'file',
      target: 'node_extract',
      targetHandle: 'file',
    },
    {
      id: 'edge2',
      source: 'node_extract',
      sourceHandle: 'text',
      target: 'node_parse',
      targetHandle: 'text',
    },
    {
      id: 'edge3',
      source: 'node_parse',
      sourceHandle: 'report',
      target: 'node_display',
      targetHandle: 'data',
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const FULL_CREDIT_PIPELINE: PipelineDefinition = {
  id: generatePipelineId(),
  name: 'Full Credit Report Pipeline',
  description: 'Complete pipeline with AI account extraction',
  nodes: [
    {
      id: 'node_upload',
      type: 'custom',
      position: { x: 100, y: 200 },
      data: {
        label: 'PDF Upload',
        type: 'input.pdf-upload',
        category: 'input',
        config: {},
        inputs: [],
        outputs: [
          { id: 'file', label: 'file', dataType: 'file', required: false },
          { id: 'metadata', label: 'metadata', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_extract',
      type: 'custom',
      position: { x: 350, y: 200 },
      data: {
        label: 'Extract Text',
        type: 'processing.pdf-extract-text',
        category: 'processing',
        config: {},
        inputs: [{ id: 'file', label: 'file', dataType: 'file', required: true }],
        outputs: [
          { id: 'text', label: 'text', dataType: 'text', required: false },
          { id: 'pageCount', label: 'pageCount', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_parse',
      type: 'custom',
      position: { x: 600, y: 200 },
      data: {
        label: 'Parse Report',
        type: 'processing.credit-report-parser',
        category: 'processing',
        config: { useAI: true },
        inputs: [{ id: 'text', label: 'text', dataType: 'text', required: true }],
        outputs: [{ id: 'report', label: 'report', dataType: 'creditReport', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_accounts',
      type: 'custom',
      position: { x: 850, y: 200 },
      data: {
        label: 'Extract Accounts',
        type: 'ai.account-extraction',
        category: 'ai',
        config: {},
        inputs: [{ id: 'report', label: 'report', dataType: 'creditReport', required: true }],
        outputs: [
          { id: 'accounts', label: 'accounts', dataType: 'accounts', required: false },
          { id: 'logs', label: 'logs', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_display',
      type: 'custom',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Display',
        type: 'output.display',
        category: 'output',
        config: { format: 'json' },
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [],
        status: 'idle',
      },
    },
  ],
  edges: [
    {
      id: 'edge1',
      source: 'node_upload',
      sourceHandle: 'file',
      target: 'node_extract',
      targetHandle: 'file',
    },
    {
      id: 'edge2',
      source: 'node_extract',
      sourceHandle: 'text',
      target: 'node_parse',
      targetHandle: 'text',
    },
    {
      id: 'edge3',
      source: 'node_parse',
      sourceHandle: 'report',
      target: 'node_accounts',
      targetHandle: 'report',
    },
    {
      id: 'edge4',
      source: 'node_accounts',
      sourceHandle: 'accounts',
      target: 'node_display',
      targetHandle: 'data',
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const IMAGE_OCR_PIPELINE: PipelineDefinition = {
  id: generatePipelineId(),
  name: 'Image OCR Pipeline',
  description: 'Convert PDF to images and extract text with OCR',
  nodes: [
    {
      id: 'node_upload',
      type: 'custom',
      position: { x: 100, y: 200 },
      data: {
        label: 'PDF Upload',
        type: 'input.pdf-upload',
        category: 'input',
        config: {},
        inputs: [],
        outputs: [{ id: 'file', label: 'file', dataType: 'file', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_to_image',
      type: 'custom',
      position: { x: 350, y: 200 },
      data: {
        label: 'PDF to Image',
        type: 'processing.pdf-to-image',
        category: 'processing',
        config: { pageNumber: 1, scale: 2 },
        inputs: [{ id: 'file', label: 'file', dataType: 'file', required: true }],
        outputs: [{ id: 'images', label: 'images', dataType: 'any', required: false }],
        status: 'idle',
      },
    },
    {
      id: 'node_ocr',
      type: 'custom',
      position: { x: 600, y: 200 },
      data: {
        label: 'Tesseract OCR',
        type: 'ai.tesseract-ocr',
        category: 'ai',
        config: {},
        inputs: [{ id: 'image', label: 'image', dataType: 'image', required: true }],
        outputs: [
          { id: 'text', label: 'text', dataType: 'text', required: false },
          { id: 'confidence', label: 'confidence', dataType: 'any', required: false },
        ],
        status: 'idle',
      },
    },
    {
      id: 'node_display',
      type: 'custom',
      position: { x: 850, y: 200 },
      data: {
        label: 'Display',
        type: 'output.display',
        category: 'output',
        config: { format: 'json' },
        inputs: [{ id: 'data', label: 'data', dataType: 'any', required: true }],
        outputs: [],
        status: 'idle',
      },
    },
  ],
  edges: [
    {
      id: 'edge1',
      source: 'node_upload',
      sourceHandle: 'file',
      target: 'node_to_image',
      targetHandle: 'file',
    },
    {
      id: 'edge2',
      source: 'node_to_image',
      sourceHandle: 'images',
      target: 'node_ocr',
      targetHandle: 'image',
    },
    {
      id: 'edge3',
      source: 'node_ocr',
      sourceHandle: 'text',
      target: 'node_display',
      targetHandle: 'data',
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const DEFAULT_PIPELINES = [
  COMPLETE_BACKEND_PIPELINE,
  BASIC_CREDIT_REPORT_PIPELINE,
  FULL_CREDIT_PIPELINE,
  IMAGE_OCR_PIPELINE,
];

export function getDefaultPipeline(name: string): PipelineDefinition | null {
  return DEFAULT_PIPELINES.find((p) => p.name === name) || null;
}
