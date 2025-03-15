import json
import subprocess
import logging
from typing import Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

class ProcessingError(Exception):
    """Custom exception for processing errors"""
    pass

def process_image_typescript(image_path: str) -> Dict[str, Any]:
    """Bridge between Python Flask and TypeScript processing"""
    if not Path(image_path).is_file():
        raise ProcessingError(f"Image file not found: {image_path}")

    try:
        # Get absolute path to JS script
        script_path = Path(__file__).parent.parent.parent / 'dist' / 'examples' / 'ocrExample.js'
        
        # Call TypeScript processor
        result = subprocess.run(
            ['node', str(script_path), image_path],
            capture_output=True,
            text=True,
            check=True,
            timeout=30  # 30 second timeout
        )
        
        # Parse JSON output
        return json.loads(result.stdout)

    except subprocess.TimeoutExpired:
        logger.error("Processing timed out")
        raise ProcessingError("Image processing timed out")
    
    except subprocess.CalledProcessError as e:
        logger.error(f"Process failed: {e.stderr}")
        raise ProcessingError(f"Processing failed: {e.stderr}")
    
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing failed: {e}")
        raise ProcessingError(f"Failed to parse processing results: {e}")
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise ProcessingError(f"Unexpected error during processing: {e}")
