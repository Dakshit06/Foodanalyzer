import { OCRService } from '../services/OCRService.js';
import { ImageProcessor } from '../services/ImageProcessor.js';
import type { OCRResult } from '../services/OCRService.js';

async function processImage(imagePath: string): Promise<OCRResult> {
  const ocrService = new OCRService();
  const imageProcessor = new ImageProcessor();
  
  try {
    console.log('Initializing services...');
    await Promise.all([
      imageProcessor.initialize(),
      ocrService.initialize()
    ]);
    console.log('Services initialized successfully');

    console.log('Processing image:', imagePath);
    const processedImage = await imageProcessor.processImage(imagePath);
    console.log('Image processed successfully');

    console.log('Extracting text and analyzing content...');
    const result = await ocrService.extractTextFromProcessedImage(processedImage);
    console.log('Analysis complete');

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Processing failed:', errorMessage);
    throw new Error(`Image processing failed: ${errorMessage}`);
  } finally {
    try {
      await ocrService.cleanup();
      console.log('Cleanup completed successfully');
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
    }
  }
}

// Handle command-line usage
if (process.argv[2]) {
  const imagePath = process.argv[2];
  
  if (!imagePath.match(/\.(jpg|jpeg|png|gif)$/i)) {
    console.error('Error: Please provide a valid image file path');
    process.exit(1);
  }

  processImage(imagePath)
    .then(result => {
      console.log('\nProcessing Results:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('\nError:', error.message);
      process.exit(1);
    });
}

export { processImage };
