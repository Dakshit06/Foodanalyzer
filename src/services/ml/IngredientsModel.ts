import * as tf from '@tensorflow/tfjs-node';
import { readFileSync } from 'fs';
import path from 'path';

const HARMFUL_INGREDIENTS = new Set([
  'sodium nitrite', 'bha', 'bht', 'sodium benzoate',
  'potassium bromate', 'propylene glycol', 'carrageenan',
  'artificial color', 'artificial sweetener', 'msg'
]);

interface TrainingData {
  inputs: tf.Tensor2D;
  labels: tf.Tensor2D;
}

export class IngredientsModel {
  private model: tf.LayersModel | null = null;
  
  async buildModel(): Promise<tf.LayersModel> {
    const model = tf.sequential();
    
    model.add(tf.layers.embedding({
      inputDim: 5000,  // Vocabulary size
      outputDim: 32,
      inputLength: 100
    }));
    
    model.add(tf.layers.lstm({
      units: 64,
      returnSequences: false
    }));
    
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.5 }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  async loadOrCreateModel(): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(
        'file://src/models/ingredients_model/model.json'
      );
    } catch {
      this.model = await this.buildModel();
      await this.trainModel();
    }
  }

  private async trainModel(): Promise<void> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const trainingData = this.loadTrainingData();
    const { inputs, labels } = this.preprocessTrainingData(trainingData);
    
    try {
      await this.model.fit(inputs, labels, {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}: loss = ${logs?.loss.toFixed(4)}`);
          }
        }
      });

      await this.model.save('file://src/models/ingredients_model');
    } finally {
      // Cleanup tensors
      inputs.dispose();
      labels.dispose();
    }
  }

  private preprocessTrainingData(ingredients: string[]): TrainingData {
    const features: number[][] = [];
    const labels: number[] = [];

    for (const ingredient of ingredients) {
      const isHarmful = Array.from(HARMFUL_INGREDIENTS).some(
        harmful => ingredient.toLowerCase().includes(harmful)
      );
      
      const ingredientFeatures = this.createFeatureVector(ingredient);
      features.push(ingredientFeatures);
      labels.push(isHarmful ? 1 : 0);
    }

    return {
      inputs: tf.tensor2d(features),
      labels: tf.tensor2d(labels, [labels.length, 1])
    };
  }

  private createFeatureVector(ingredient: string): number[] {
    return Array.from(HARMFUL_INGREDIENTS).map(harmful => 
      ingredient.toLowerCase().includes(harmful) ? 1 : 0
    );
  }

  async predictHarmful(ingredient: string): Promise<number> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    if (!ingredient || typeof ingredient !== 'string') {
      throw new Error('Invalid ingredient input');
    }

    let processed: tf.Tensor2D | null = null;
    let prediction: tf.Tensor | null = null;

    try {
      processed = this.preprocessInput(ingredient);
      prediction = this.model.predict(processed) as tf.Tensor;
      return (await prediction.data())[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Prediction failed: ${errorMessage}`);
    } finally {
      // Clean up tensors in finally block to ensure they're always disposed
      if (processed) processed.dispose();
      if (prediction) prediction.dispose();
    }
  }

  private preprocessInput(text: string): tf.Tensor2D {
    const features = this.createFeatureVector(text);
    return tf.tensor2d([features], [1, HARMFUL_INGREDIENTS.size]);
  }

  private loadTrainingData(): string[] {
    const dataPath = path.join(process.cwd(), 'src/data/harmful_ingredients.json');
    const rawData = readFileSync(dataPath, 'utf-8');
    return JSON.parse(rawData);
  }
}
