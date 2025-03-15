import opencv from '@u4/opencv4nodejs';
import sharp from 'sharp';
import { MLClassifier, ClassificationResult } from './MLClassifier.js';

export interface ProcessedImage {
  nutritionTable?: opencv.Mat;
  ingredientsList?: opencv.Mat;
  fullImage: opencv.Mat;
  classification?: ClassificationResult[];
}

export class ImageProcessor {
  private readonly classifier: MLClassifier;
  private isInitialized = false;

  constructor() {
    this.classifier = new MLClassifier({ modelType: 'food' });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.classifier.initialize();
    this.isInitialized = true;
  }

  async processImage(imagePath: string): Promise<ProcessedImage> {
    if (!this.isInitialized) {
      throw new Error('ImageProcessor not initialized');
    }

    let image: opencv.Mat | null = null;
    let gray: opencv.Mat | null = null;
    let thresh: opencv.Mat | null = null;

    try {
      image = await opencv.imreadAsync(imagePath);
      if (!image || image.empty) {
        throw new Error('Failed to load image');
      }

      gray = image.cvtColor(opencv.COLOR_BGR2GRAY);
      thresh = gray.adaptiveThreshold(
        255,
        opencv.ADAPTIVE_THRESH_GAUSSIAN_C,
        opencv.THRESH_BINARY,
        11,
        2
      );

      const contours = thresh.findContours(
        opencv.RETR_EXTERNAL,
        opencv.CHAIN_APPROX_SIMPLE
      );

      const [nutritionTable, ingredientsList] = await Promise.all([
        this.detectNutritionTable(image, contours),
        this.detectIngredientsList(image, contours)
      ]);

      const imageBuffer = await this.prepareImageForClassification(image);
      const classification = await this.classifier.classifyImage(imageBuffer);

      return {
        nutritionTable,
        ingredientsList,
        fullImage: image,
        classification
      };
    } catch (error) {
      // Cleanup on error
      if (gray) gray.delete();
      if (thresh) thresh.delete();
      throw error;
    }
  }

  private async prepareImageForClassification(image: opencv.Mat): Promise<Buffer> {
    const jpegBuffer = await opencv.imencodeAsync('.jpg', image);
    return await sharp(jpegBuffer)
      .resize(224, 224, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .normalize()
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  private detectNutritionTable(image: opencv.Mat, contours: opencv.Contour[]): opencv.Mat | undefined {
    // Find the largest rectangular contour
    const tableContour = contours
      .filter(contour => {
        const rect = contour.boundingRect();
        return rect.width > image.cols * 0.2 && rect.height > image.rows * 0.2;
      })
      .sort((a, b) => b.area - a.area)[0];

    if (tableContour) {
      const rect = tableContour.boundingRect();
      return image.getRegion(rect);
    }
    return undefined;
  }

  private detectIngredientsList(image: opencv.Mat, contours: opencv.Contour[]): opencv.Mat | undefined {
    // Enhanced detection using text density and layout analysis
    const textRegions = contours.filter(contour => {
      const rect = contour.boundingRect();
      const aspect = rect.width / rect.height;
      const area = rect.width * rect.height;
      const areaRatio = area / (image.cols * image.rows);
      
      return (
        aspect > 1.5 && 
        aspect < 4 && 
        areaRatio > 0.1 && 
        rect.width > image.cols * 0.25
      );
    });

    if (textRegions.length > 0) {
      const region = textRegions[0].boundingRect();
      const extracted = image.getRegion(region);
      return this.enhanceTextRegion(extracted);
    }
    return undefined;
  }

  private enhanceTextRegion(region: opencv.Mat): opencv.Mat {
    // Apply additional preprocessing for better text recognition
    const gray = region.cvtColor(opencv.COLOR_BGR2GRAY);
    const blurred = gray.gaussianBlur(new opencv.Size(3, 3), 0);
    return blurred.threshold(0, 255, opencv.THRESH_BINARY + opencv.THRESH_OTSU);
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
    // Add any necessary cleanup logic
  }
}
