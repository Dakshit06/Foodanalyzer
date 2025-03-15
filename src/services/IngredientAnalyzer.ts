import * as tf from '@tensorflow/tfjs-node';
import { pipeline } from '@xenova/transformers';
import { IngredientsModel } from './ml/IngredientsModel.js';

export interface IngredientAnalysis {
  ingredient: string;
  harmfulProbability: number;
  category?: string;
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
  private ingredientsModel: IngredientsModel;

  constructor() {
    this.ingredientsModel = new IngredientsModel();
  }

  async initialize(): Promise<void> {
    await this.ingredientsModel.loadOrCreateModel();
    this.nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER', {
      quantized: false
    });
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
      const probability = await this.ingredientsModel.predictHarmful(ingredient);
      
      results.push({
        ingredient,
        harmfulProbability: probability,
        category: this.categorizeIngredient(probability)
      });
    }

    return results;
  }

  private async extractNamedEntities(text: string): Promise<NamedEntity[]> {
    try {
      const entities = await this.nerPipeline(text, {
        aggregation_strategy: 'simple'
      });
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
