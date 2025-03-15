#!/bin/bash

# Cleanup existing environment
rm -rf venv
rm -rf __pycache__
rm -rf src/__pycache__

# Create new virtual environment
python3 -m venv venv
source venv/bin/activate

# Install base packages first
pip install --upgrade pip wheel setuptools

# Install requirements one by one to avoid dependency conflicts
pip install Flask==2.3.3
pip install Werkzeug==2.3.7
pip install gunicorn==21.2.0
pip install python-dotenv==1.0.0
pip install flask-cors==4.0.0
pip install opencv-python-headless==4.8.0.74
pip install Pillow==10.0.0
pip install pytesseract==0.3.10
pip install tensorflow-cpu==2.16.1
pip install numpy==1.24.3
pip install boto3==1.28.40
pip install ml-dtypes==0.3.1

# Create necessary directories
mkdir -p uploads
mkdir -p src/models/food_classifier
mkdir -p src/models/ingredients_model

# Set environment variables
export PYTHONPATH=/workspaces/Foodanalyzer
export FLASK_APP=src.server.app
export FLASK_ENV=development
