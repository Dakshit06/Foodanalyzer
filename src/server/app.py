from flask import Flask, request, jsonify, make_response
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
from typing import Dict, Any, Tuple
from dotenv import load_dotenv
from flask_cors import CORS

# Load environment variables
load_dotenv()

# Create Flask app with proper config
def create_app():
    app = Flask(__name__)
    
    # Configure app based on environment
    is_prod = os.getenv('FLASK_ENV', 'production') == 'production'
    app.config.update(
        ENV=os.getenv('FLASK_ENV', 'production'),
        DEBUG=not is_prod,
        UPLOAD_FOLDER='uploads',
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,
        ALLOWED_EXTENSIONS={'png', 'jpg', 'jpeg'}
    )

    # Enable CORS for GitHub Codespaces
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    return app

app = create_app()

# Handle CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def get_unique_filename(filename: str) -> str:
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    name, ext = os.path.splitext(secure_filename(filename))
    return f"{name}_{timestamp}{ext}"

@app.route('/api/analyze', methods=['POST'])
def analyze_image() -> Tuple[Dict, int]:
    # Validate request
    if 'file' not in request.files:
        return {'error': 'No file provided'}, 400
    
    file = request.files['file']
    if not file.filename:
        return {'error': 'No file selected'}, 400
        
    if not allowed_file(file.filename):
        return {'error': 'Invalid file type'}, 400

    try:
        # Save file with unique name
        filename = get_unique_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Process image
        result = process_image(filepath)
        return {'success': True, 'result': result}, 200

    except Exception as e:
        app.logger.error(f"Error processing image: {repr(e)}")
        return {'error': 'Image processing failed', 'details': repr(e)}, 500

    finally:
        # Cleanup uploaded file
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                app.logger.warning(f"Failed to cleanup file {filepath}: {repr(e)}")

@app.route('/api/health', methods=['GET'])
def health_check() -> Tuple[Dict, int]:
    """Health check endpoint"""
    return {'status': 'healthy'}, 200

# Add error handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Not Found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal Server Error'}), 500

# Update process_image function
def process_image(filepath: str) -> Dict[str, Any]:
    """Process image using TypeScript services"""
    try:
        # Ensure file exists
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")
            
        from src.services.bridge import process_image_typescript
        return process_image_typescript(filepath)
    except ImportError as e:
        app.logger.error(f"Failed to import bridge module: {repr(e)}")
        raise RuntimeError("Failed to initialize image processing")
    except Exception as e:
        app.logger.error(f"Processing error: {repr(e)}")
        raise

def run_production_server(app, port):
    """Run production server with fallback options"""
    try:
        from waitress import serve
        print("Starting production server with Waitress...")
        serve(app, host='0.0.0.0', port=port)
    except ImportError:
        try:
            from gunicorn.app.base import BaseApplication

            class FlaskApplication(BaseApplication):
                def __init__(self, app, options=None):
                    self.application = app
                    self.options = options or {}
                    super().__init__()

                def load_config(self):
                    for key, value in self.options.items():
                        self.cfg.set(key, value)

                def load(self):
                    return self.application

            print("Starting production server with Gunicorn...")
            options = {
                'bind': f'0.0.0.0:{port}',
                'workers': 3,
                'timeout': 120
            }
            FlaskApplication(app, options).run()
        except ImportError:
            print("Warning: Production servers not available. Using Flask development server...")
            app.run(host='0.0.0.0', port=port)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    is_prod = os.getenv('FLASK_ENV', 'production') == 'production'
    
    if is_prod:
        run_production_server(app, port)
    else:
        print("Starting development server...")
        app.run(debug=True, host='0.0.0.0', port=port)
