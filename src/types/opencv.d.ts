declare module '@u4/opencv4nodejs' {
  export interface Mat {
    empty: boolean;
    cols: number;
    rows: number;
    delete(): void;
    cvtColor(code: number): Mat;
    adaptiveThreshold(maxVal: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number): Mat;
    findContours(mode: number, method: number): Contour[];
    getRegion(rect: Rect): Mat;
    gaussianBlur(size: Size, sigma: number): Mat;
    threshold(thresh: number, maxVal: number, type: number): Mat;
  }

  export interface Contour {
    area: number;
    boundingRect(): Rect;
  }

  export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface Size {
    width: number;
    height: number;
  }

  export const COLOR_BGR2GRAY: number;
  export const ADAPTIVE_THRESH_GAUSSIAN_C: number;
  export const THRESH_BINARY: number;
  export const THRESH_BINARY_INV: number;
  export const THRESH_OTSU: number;
  export const RETR_EXTERNAL: number;
  export const CHAIN_APPROX_SIMPLE: number;

  export function imreadAsync(path: string): Promise<Mat>;
  export function imencodeAsync(ext: string, img: Mat): Promise<Buffer>;

  export class Size {
    constructor(width: number, height: number);
  }
}
