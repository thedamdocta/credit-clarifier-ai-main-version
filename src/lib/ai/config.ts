
import { env } from '@huggingface/transformers';

// Configure environment
env.allowLocalModels = true;
env.useBrowserCache = true;

// Define the model we'll use
export const TEXT_CLASSIFICATION_MODEL = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
export const NER_MODEL = 'Xenova/bert-base-NER';
