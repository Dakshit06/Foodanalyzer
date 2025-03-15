export interface OCROptions {
  language?: string;
  preprocess?: boolean;
  timeout?: number;
}

export interface OCRTextBlock {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export type OCRResult = {
  text: string;
  confidence: number;
  blocks?: OCRTextBlock[];
};
