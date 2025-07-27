# GenAI Multimodal Description & Q&A

## Overview
This project allows users to upload or input various file types (text, PDF, Word, images, code, video) and generates a detailed description using Gemini Flash 1.5 API. Users can then ask questions about the generated description for Q&A.

## Features
- Accepts text, PDF, Word (docx), image, code, and video files
- Extracts content from each file type
- Generates a detailed description using Gemini Flash 1.5
- Q&A over the generated description
- Simple web UI (Streamlit)

## Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set your Gemini API key as an environment variable:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```
   (On Windows: `set GEMINI_API_KEY=your_api_key_here`)

## Usage
Run the app:
```bash
streamlit run main.py
```

Upload a file or enter text, get a description, and ask questions! 

Your GenAI multimodal project is now scaffolded and ready! Here’s what’s included:

### ✅ Features Implemented
- **Handles all input types:** text, PDF, Word, image, code, video
- **Extraction utilities** for each type in `utils/`
- **Streamlit web app** (`main.py`) for upload, description generation, and Q&A
- **Gemini Flash 1.5 API** integration
- **Requirements and README** for setup

---

## 🚀 Next Steps

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set your Gemini API key:**
   - On Windows:
     ```
     set GEMINI_API_KEY=your_api_key_here
     ```
   - On Mac/Linux:
     ```
     export GEMINI_API_KEY=your_api_key_here
     ```

3. **Run the app:**
   ```bash
   streamlit run main.py
   ```

4. **Upload a file or enter text/code, generate a description, and ask questions!**

---

## ⚠️ Notes
- For video/audio transcription, the first run of Whisper will download the model (may take time).
- If you want to support more code file types, just add their extensions in `main.py`.
- You can further improve the UI or add error handling as needed.

---

Would you like any additional features, improvements, or help with deployment? 