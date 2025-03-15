import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs/promises';

const AVAILABLE_MODELS = {
  food: 'nateraw/food',
  foodBase: 'food-base/food-classifier',
  fineTuned: 'file://src/models/fine_tuned_model'
} as const;

export interface ClassificationResult {
  label: string;
  score: number;
  confidence?: number;
}

export interface ModelConfig {
  modelType: keyof typeof AVAILABLE_MODELS;
  finetuneEpochs?: number;
  batchSize?: number;
}

export class MLClassifier {
  private classifier: any = null;
  private model: any = null;
  private readonly modelPath: string;
  private readonly modelName: string;
  private isInitialized = false;
  private modelLock: Promise<void> | null = null;

  constructor(private config: ModelConfig = { modelType: 'food' }) {
    this.modelName = AVAILABLE_MODELS[config.modelType];
    this.modelPath = path.join(process.cwd(), 'src/models/food_classifier', config.modelType);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.modelLock) await this.modelLock;

    this.modelLock = this.initializeModel();
    try {
      await this.modelLock;
    } finally {
      this.modelLock = null;
    }
  }

  private async initializeModel(): Promise<void> {
    try {
      await this.ensureModelDirectory();
      
      const options = {
        quantized: false,
        cache_dir: this.modelPath,
        local_files_only: await this.isModelCached(),
        progress_callback: (progress: number) => {
          console.log(`Loading model: ${Math.round(progress * 100)}%`);
        }
      };

      [this.classifier, this.model] = await Promise.all([
        pipeline('image-classification', this.modelName, options),
        pipeline('feature-extraction', this.modelName, options)
      ]);

      this.isInitialized = true;
      console.log('Model initialization complete');
    } catch (error) {
      this.isInitialized = false;
      throw this.handleError('Model initialization failed', error);
    }
  }

  async classifyImage(image: Buffer): Promise<ClassificationResult[]> {
    if (!this.isInitialized || !this.classifier) {
      throw new Error('Classifier not initialized');
    }

    try {
      const results = await this.classifier(image, {
        topk: 5,
        min_score: 0.1
      });

      return results
        .filter(this.isValidPrediction)
        .map(this.validatePrediction);
    } catch (error) {
      throw this.handleError('Classification failed', error);
    }
  }

  private handleError(context: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`${context}: ${message}`);
  }

  private isValidPrediction(prediction: any): prediction is { label: string; score: number } {
    return (
      prediction &&
      typeof prediction.label === 'string' &&
      typeof prediction.score === 'number' &&
      prediction.score >= 0 &&
      prediction.score <= 1
    );
  }

  private async ensureModelDirectory(): Promise<void> {
    try {
      if (!(await this.directoryExists(this.modelPath))) {
        await fs.mkdir(this.modelPath, { recursive: true });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create or access model directory: ${errorMessage}`);
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async isModelCached(): Promise<boolean> {
    try {
      const files = await fs.readdir(this.modelPath);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  private async cacheModel(): Promise<void> {
    try {
      await this.model?.save(this.modelPath);
      console.log('Model cached successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Failed to cache model:', message);
    }
  }

  private async fineTuneModel(): Promise<void> {
    try {
      console.log('Starting fine-tuning...');
      
      // Use pipeline for model initialization instead of AutoModelForImageClassification
      if (!this.model) {
        this.model = await pipeline('image-classification', this.modelName, {
          quantized: false,
          revision: 'main'
        });
      }

      const trainingConfig = {
        epochs: this.config.finetuneEpochs ?? 3,
        batchSize: this.config.batchSize ?? 8,
        evaluationStrategy: 'steps' as const,
        evaluationSteps: 100,
        saveStrategy: 'epoch' as const,
        learningRate: 2e-5,
        weightDecay: 0.01
      };

      await this.model.train(trainingConfig);
      await this.cacheModel();
      console.log('Fine-tuning complete');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Fine-tuning failed: ${message}`);
    }
  }

  private validatePrediction(prediction: any): ClassificationResult {
    if (!prediction?.label || typeof prediction.score !== 'number') {
      throw new Error('Invalid prediction format');
    }

    return {
      label: prediction.label,
      score: prediction.score,
      confidence: Math.round(prediction.score * 100) / 100
    };
  }

  async cleanup(): Promise<void> {
    try {
      if (this.model) {
        await this.model.cleanup();
        this.model = null;
      }
      if (this.classifier) {
        await this.classifier.cleanup();
        this.classifier = null;
      }
      this.isInitialized = false;
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }
}
