// Input nodes
export { PdfUploadNode } from './input/PdfUploadNode';
export { TextInputNode } from './input/TextInputNode';
export { ConfigSourceNode } from './input/ConfigSourceNode';

// Processing nodes
export { PdfExtractTextNode } from './processing/PdfExtractTextNode';
export { CreditReportParserNode } from './processing/CreditReportParserNode';
export { BureauIdentifierNode } from './processing/BureauIdentifierNode';
export { PdfToImageNode } from './processing/PdfToImageNode';
export { EquifaxSummaryExtractorNode } from './processing/EquifaxSummaryExtractorNode';
export { EquifaxSummaryEnhancerNode } from './processing/EquifaxSummaryEnhancerNode';
export { PageNumberDeriverNode } from './processing/PageNumberDeriverNode';
export { DebugPageImageBuilderNode } from './processing/DebugPageImageBuilderNode';

// AI nodes
export { AccountExtractionNode } from './ai/AccountExtractionNode';
export { OpenAIVisionNode } from './ai/OpenAIVisionNode';
export { OpenAITableExtractNode } from './ai/OpenAITableExtractNode';
export { HuggingFaceNERNode } from './ai/HuggingFaceNERNode';
export { TesseractOCRNode } from './ai/TesseractOCRNode';
export { CreditReportAIParserNode } from './ai/CreditReportAIParserNode';
export { CreditReportAIEnhancerNode } from './ai/CreditReportAIEnhancerNode';
export { AccountDetectionNode } from './ai/AccountDetectionNode';
export { SingleAccountExtractorNode } from './ai/SingleAccountExtractorNode';
export { BureauIdentifierAINode } from './ai/BureauIdentifierAINode';
export { OpenAICallerNode } from './ai/OpenAICallerNode';
export { DetectionPromptBuilderNode } from './ai/DetectionPromptBuilderNode';
export { ExtractionPromptBuilderNode } from './ai/ExtractionPromptBuilderNode';

// Transform nodes
export { DataMapperNode } from './transform/DataMapperNode';
export { FilterNode } from './transform/FilterNode';
export { MergeNode } from './transform/MergeNode';
export { AccountSnippetBuilderNode } from './transform/AccountSnippetBuilderNode';
export { DebugPageCreatorNode } from './transform/DebugPageCreatorNode';
export { WhitespaceNormalizerNode } from './transform/WhitespaceNormalizerNode';
export { RegexEscapeNode } from './transform/RegexEscapeNode';
export { AnchorTextFinderNode } from './transform/AnchorTextFinderNode';
export { PromptTemplateParserNode } from './transform/PromptTemplateParserNode';
export { JSONResponseParserNode } from './transform/JSONResponseParserNode';
export { PageBoundarySplitterNode } from './transform/PageBoundarySplitterNode';

// Output nodes
export { DisplayNode } from './output/DisplayNode';
export { WebhookNode } from './output/WebhookNode';
export { ExportNode } from './output/ExportNode';

// Control nodes
export { ConditionalNode } from './control/ConditionalNode';
export { LoopNode } from './control/LoopNode';
export { APIKeyValidatorNode } from './control/APIKeyValidatorNode';
export { AccountErrorHandlerNode } from './control/AccountErrorHandlerNode';

// Register all default nodes
import { nodeRegistry } from '../core/registry';
import { PdfUploadNode } from './input/PdfUploadNode';
import { TextInputNode } from './input/TextInputNode';
import { ConfigSourceNode } from './input/ConfigSourceNode';
import { PdfExtractTextNode } from './processing/PdfExtractTextNode';
import { CreditReportParserNode } from './processing/CreditReportParserNode';
import { BureauIdentifierNode } from './processing/BureauIdentifierNode';
import { PdfToImageNode } from './processing/PdfToImageNode';
import { EquifaxSummaryExtractorNode } from './processing/EquifaxSummaryExtractorNode';
import { EquifaxSummaryEnhancerNode } from './processing/EquifaxSummaryEnhancerNode';
import { PageNumberDeriverNode } from './processing/PageNumberDeriverNode';
import { DebugPageImageBuilderNode } from './processing/DebugPageImageBuilderNode';
import { AccountExtractionNode } from './ai/AccountExtractionNode';
import { OpenAIVisionNode } from './ai/OpenAIVisionNode';
import { OpenAITableExtractNode } from './ai/OpenAITableExtractNode';
import { HuggingFaceNERNode } from './ai/HuggingFaceNERNode';
import { TesseractOCRNode } from './ai/TesseractOCRNode';
import { CreditReportAIParserNode } from './ai/CreditReportAIParserNode';
import { CreditReportAIEnhancerNode } from './ai/CreditReportAIEnhancerNode';
import { AccountDetectionNode } from './ai/AccountDetectionNode';
import { SingleAccountExtractorNode } from './ai/SingleAccountExtractorNode';
import { BureauIdentifierAINode } from './ai/BureauIdentifierAINode';
import { OpenAICallerNode } from './ai/OpenAICallerNode';
import { DetectionPromptBuilderNode } from './ai/DetectionPromptBuilderNode';
import { ExtractionPromptBuilderNode } from './ai/ExtractionPromptBuilderNode';
import { DataMapperNode } from './transform/DataMapperNode';
import { FilterNode } from './transform/FilterNode';
import { MergeNode } from './transform/MergeNode';
import { AccountSnippetBuilderNode } from './transform/AccountSnippetBuilderNode';
import { DebugPageCreatorNode } from './transform/DebugPageCreatorNode';
import { WhitespaceNormalizerNode } from './transform/WhitespaceNormalizerNode';
import { RegexEscapeNode } from './transform/RegexEscapeNode';
import { AnchorTextFinderNode } from './transform/AnchorTextFinderNode';
import { PromptTemplateParserNode } from './transform/PromptTemplateParserNode';
import { JSONResponseParserNode } from './transform/JSONResponseParserNode';
import { PageBoundarySplitterNode } from './transform/PageBoundarySplitterNode';
import { DisplayNode } from './output/DisplayNode';
import { WebhookNode } from './output/WebhookNode';
import { ExportNode } from './output/ExportNode';
import { ConditionalNode } from './control/ConditionalNode';
import { LoopNode } from './control/LoopNode';
import { APIKeyValidatorNode } from './control/APIKeyValidatorNode';
import { AccountErrorHandlerNode } from './control/AccountErrorHandlerNode';

export function registerDefaultNodes() {
  // Input nodes
  nodeRegistry.register(new PdfUploadNode());
  nodeRegistry.register(new TextInputNode());
  nodeRegistry.register(new ConfigSourceNode());

  // Processing nodes
  nodeRegistry.register(new PdfExtractTextNode());
  nodeRegistry.register(new CreditReportParserNode());
  nodeRegistry.register(new BureauIdentifierNode());
  nodeRegistry.register(new PdfToImageNode());
  nodeRegistry.register(new EquifaxSummaryExtractorNode());
  nodeRegistry.register(new EquifaxSummaryEnhancerNode());
  nodeRegistry.register(new PageNumberDeriverNode());
  nodeRegistry.register(new DebugPageImageBuilderNode());

  // AI nodes
  nodeRegistry.register(new AccountExtractionNode());
  nodeRegistry.register(new OpenAIVisionNode());
  nodeRegistry.register(new OpenAITableExtractNode());
  nodeRegistry.register(new HuggingFaceNERNode());
  nodeRegistry.register(new TesseractOCRNode());
  nodeRegistry.register(new CreditReportAIParserNode());
  nodeRegistry.register(new CreditReportAIEnhancerNode());
  nodeRegistry.register(new AccountDetectionNode());
  nodeRegistry.register(new SingleAccountExtractorNode());
  nodeRegistry.register(new BureauIdentifierAINode());
  nodeRegistry.register(new OpenAICallerNode());
  nodeRegistry.register(new DetectionPromptBuilderNode());
  nodeRegistry.register(new ExtractionPromptBuilderNode());

  // Transform nodes
  nodeRegistry.register(new DataMapperNode());
  nodeRegistry.register(new FilterNode());
  nodeRegistry.register(new MergeNode());
  nodeRegistry.register(new AccountSnippetBuilderNode());
  nodeRegistry.register(new DebugPageCreatorNode());
  nodeRegistry.register(new WhitespaceNormalizerNode());
  nodeRegistry.register(new RegexEscapeNode());
  nodeRegistry.register(new AnchorTextFinderNode());
  nodeRegistry.register(new PromptTemplateParserNode());
  nodeRegistry.register(new JSONResponseParserNode());
  nodeRegistry.register(new PageBoundarySplitterNode());

  // Output nodes
  nodeRegistry.register(new DisplayNode());
  nodeRegistry.register(new WebhookNode());
  nodeRegistry.register(new ExportNode());

  // Control nodes
  nodeRegistry.register(new ConditionalNode());
  nodeRegistry.register(new LoopNode());
  nodeRegistry.register(new APIKeyValidatorNode());
  nodeRegistry.register(new AccountErrorHandlerNode());
}
