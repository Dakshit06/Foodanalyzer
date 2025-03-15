import { createWorker } from 'tesseract.js';
import type { ProcessedImage } from './ImageProcessor.js';
import { IngredientAnalyzer, IngredientAnalysis } from '../models/ingredients_model/IngredientAnalyzer.js';
import { ClassificationResult } from './MLClassifier.js';

export interface OCRResult {
  text: string;
  confidence: number;
  nutritionTable?: {
    text: string;
    confidence: number;
  };
  ingredientsList?: {
    text: string;
    confidence: number;
  };
  ingredientAnalysis?: IngredientAnalysis[];
  classification?: ClassificationResult[];
}

export class OCRService {
  private worker: Tesseract.Worker | null = null;
  private ingredientAnalyzer: IngredientAnalyzer;

  constructor() {
    this.ingredientAnalyzer = new IngredientAnalyzer();
  }

  async initialize(): Promise<void> {
    this.worker = await createWorker('eng');
    await this.ingredientAnalyzer.initialize();
  }

  async extractText(imageUrl: string): Promise<OCRResult> {
    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      const result = await this.worker.recognize(imageUrl);
      return {
        text: result.data.text,
        confidence: result.data.confidence
      };
    } catch (error) {
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  async extractTextFromProcessedImage(processedImage: ProcessedImage): Promise<OCRResult> {
    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    const result: OCRResult = {
      text: '',
      confidence: 0
    };

    try {
      // Process full image
      const fullResult = await this.worker.recognize(processedImage.fullImage);
      result.text = fullResult.data.text;
      result.confidence = fullResult.data.confidence;

      // Process nutrition table if detected
      if (processedImage.nutritionTable) {
        const nutritionResult = await this.worker.recognize(processedImage.nutritionTable);
        result.nutritionTable = {
          text: nutritionResult.data.text,
          confidence: nutritionResult.data.confidence
        };
      }

      // Process ingredients list if detected
      if (processedImage.ingredientsList) {
        const ingredientsResult = await this.worker.recognize(processedImage.ingredientsList);
        result.ingredientsList = {
          text: ingredientsResult.data.text,
          confidence: ingredientsResult.data.confidence
        };
      }

      if (processedImage.ingredientsList && result.ingredientsList) {
        const analysis = await this.ingredientAnalyzer.analyzeIngredients(
          result.ingredientsList.text
        );
        result.ingredientAnalysis = analysis;
      }

      if (processedImage.classification) {
        result.classification = processedImage.classification;
      }

      return result;
    } catch (error) {
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
