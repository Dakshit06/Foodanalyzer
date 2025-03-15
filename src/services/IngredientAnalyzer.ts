import * as tf from '@tensorflow/tfjs-node';
import { pipeline } from '@xenova/transformers';
import { IngredientsModel } from './ml/IngredientsModel.js';
import { FoodTextClassifier } from './ml/FoodTextClassifier.js';

const NER_MODELS = {
  primary: 'Xenova/bert-base-NER',
  fallback: 'sgarbi/bert-fda-nutrition-ner'
} as const;

export interface IngredientAnalysis {
  ingredient: string;
  harmfulProbability: number;
  category?: string;
  foodCategory?: string;
  confidence?: number;
}

interface NamedEntity {
  text: string;
  type: string;
  score: number;
  start: number;
  end: number;
}

export class IngredientAnalyzer {
  private nerPipeline: any = null;
  private fallbackNerPipeline: any = null;
  private ingredientsModel: IngredientsModel;
  private foodClassifier: FoodTextClassifier;

  constructor() {
    this.ingredientsModel = new IngredientsModel();
    this.foodClassifier = new FoodTextClassifier();
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.ingredientsModel.loadOrCreateModel(),
      this.foodClassifier.initialize(),
      this.initializeNER()
    ]);
  }

  private async initializeNER(): Promise<void> {
    try {
      // Try loading primary model first
      this.nerPipeline = await pipeline('token-classification', NER_MODELS.primary, {
        quantized: false
      });
    } catch (error) {
      console.warn('Primary NER model failed to load, trying fallback:', error);
      try {
        // Attempt to load fallback FDA nutrition model
        this.nerPipeline = await pipeline('token-classification', NER_MODELS.fallback, {
          quantized: false
        });
      } catch (fallbackError) {
        console.error('Failed to load both NER models:', fallbackError);
        throw new Error('Could not initialize NER models');
      }
    }
  }

  private preprocessText(text: string): number[] {
    // Simple bag of words approach
    const vocabulary = new Set(['artificial', 'preservative', 'color', 'sweetener', 'msg']);
    return Array.from(vocabulary).map(word => text.toLowerCase().includes(word) ? 1 : 0);
  }

  async analyzeIngredients(ingredientsText: string): Promise<IngredientAnalysis[]> {
    if (!this.nerPipeline) {
      throw new Error('Models not initialized');
    }

    // Perform NER analysis
    const entities = await this.extractNamedEntities(ingredientsText);
    const ingredients = this.processEntities(entities);
    const results: IngredientAnalysis[] = [];

    for (const ingredient of ingredients) {
      const [probability, foodClassification] = await Promise.all([
        this.ingredientsModel.predictHarmful(ingredient),
        this.foodClassifier.classify(ingredient)
      ]);

      const bestCategory = foodClassification[0];
      
      results.push({
        ingredient,
        harmfulProbability: probability,
        category: this.categorizeIngredient(probability),
        foodCategory: bestCategory?.label,
        confidence: bestCategory?.score
      });
    }

    return results;
  }

  private async extractNamedEntities(text: string): Promise<NamedEntity[]> {
    try {
      const entities = await this.nerPipeline(text, {
        aggregation_strategy: 'simple'
      });

      // Adjust entity filtering based on model type
      const modelType = this.nerPipeline.model.config.id;
      if (modelType.includes('fda-nutrition')) {
        // FDA model specific filtering
        return entities.filter((entity: NamedEntity) =>
          entity.type.includes('NUTRIENT') ||
          entity.type.includes('QUANTITY') ||
          entity.type.includes('INGREDIENT')
        );
      }

      // Default filtering for bert-base-NER
      return entities.filter((entity: NamedEntity) =>
        entity.type.includes('FOOD') ||
        entity.type.includes('CHEMICAL') ||
        entity.type.includes('INGREDIENT')
      );
    } catch (error) {
      console.warn('NER extraction failed:', error);
      return [];
    }
  }

  private processEntities(entities: NamedEntity[]): string[] {
    return entities.map(entity => entity.text.toLowerCase());
  }

  private categorizeIngredient(probability: number): string {
    if (probability > 0.8) return 'High Risk';
    if (probability > 0.5) return 'Moderate Risk';
    return 'Low Risk';
  }
}
