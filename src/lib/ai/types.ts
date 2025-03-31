
export interface TextClassification {
  label: string;
  score: number;
}

export interface Entity {
  entity: string;
  word: string;
  score: number;
  index: number;
  start: number;
  end: number;
}
