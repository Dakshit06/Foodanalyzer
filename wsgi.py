import os
import sys
from waitress import serve

# Add project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from src.server.app import app

if __name__ == "__main__":
    is_prod = os.getenv('FLASK_ENV', 'production') == 'production'
    if is_prod:
        serve(app, host='0.0.0.0', port=int(os.getenv('PORT', 5000)))
    else:
        app.run(debug=True, host='0.0.0.0', port=int(os.getenv('PORT', 5000)))
