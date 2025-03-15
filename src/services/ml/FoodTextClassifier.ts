import { pipeline } from '@xenova/transformers';

const FOOD_MODELS = {
  primary: 'rttl-ai/foody-bert',
  fallback: 'Xenova/bert-base-multilingual-uncased-sentiment'  // Generic fallback
} as const;

export interface ClassificationResult {
  label: string;
  score: number;
}

export class FoodTextClassifier {
  private classifier: any = null;

  async initialize(): Promise<void> {
    try {
      // Try primary food classifier first
      this.classifier = await pipeline('text-classification', FOOD_MODELS.primary, {
        quantized: false
      });
    } catch (error) {
      console.warn('Primary food classifier failed to load, trying fallback:', error);
      try {
        // Load generic sentiment classifier as fallback
        this.classifier = await pipeline('text-classification', FOOD_MODELS.fallback, {
          quantized: false
        });
      } catch (fallbackError) {
        console.error('Failed to load both classifiers:', fallbackError);
        throw new Error('Could not initialize food classifier');
      }
    }
  }

  async classify(text: string): Promise<ClassificationResult[]> {
    if (!this.classifier) {
      throw new Error('Classifier not initialized');
    }

    try {
      const results = await this.classifier(text, {
        topk: 3,
        truncation: true
      });

      // Handle different model output formats
      const modelType = this.classifier.model.config.id;
      if (modelType.includes('multilingual-uncased-sentiment')) {
        // Convert sentiment scores to food safety context
        return [{
          label: this.mapSentimentToFoodSafety(results[0].label),
          score: results[0].score
        }];
      }

      return results.map((result: any) => ({
        label: result.label,
        score: result.score
      }));
    } catch (error) {
      throw new Error(`Classification failed: ${error}`);
    }
  }

  private mapSentimentToFoodSafety(sentiment: string): string {
    // Map sentiment scores (1-5) to food safety categories
    const sentimentMap: Record<string, string> = {
      '1': 'Potentially Harmful',
      '2': 'Moderate Concern',
      '3': 'Neutral',
      '4': 'Generally Safe',
      '5': 'Very Safe'
    };
    return sentimentMap[sentiment] || 'Unknown';
  }

  async cleanup(): Promise<void> {
    if (this.classifier) {
      await this.classifier.cleanup();
      this.classifier = null;
    }
  }
}
