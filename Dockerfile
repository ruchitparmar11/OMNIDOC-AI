# Use official Python image
FROM python:3.10-slim

# Install system dependencies (Tesseract)
RUN apt-get update && apt-get install -y tesseract-ocr

# Set working directory
WORKDIR /app

# Copy project files
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Run Streamlit app
CMD ["streamlit", "run", "main.py", "--server.port=8000", "--server.address=0.0.0.0"]
