# OMNIDOC AI+ Multimodal Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Overview
OMNIDOC AI+ is an intelligent document analysis tool that processes multiple file formats and enables natural language Q&A interactions using the Gemini 2.0 pro API. Upload any supported file and get detailed descriptions and insights through an intuitive interface.

## ✨ Key Features
- **Multiple Format Support**
  - Text files (.txt)
  - PDF documents
  - Microsoft Word (.docx)
  - Images (png, jpg, jpeg)
  - Source code files
  - Video files
- **Smart Processing**
  - Automatic content extraction
  - AI-powered descriptions
  - Interactive Q&A system
- **User-Friendly Interface**
  - Built with Streamlit
  - Simple upload mechanism
  - Real-time processing

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- Gemini API key
- Git

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/ruchitparmar11/omnidoc-ai.git
   cd omnidoc-ai+
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure API key:
   ```bash
   # Windows
   set GEMINI_API_KEY=your_api_key_here

   # Linux/MacOS
   export GEMINI_API_KEY=your_api_key_here
   ```

### Usage
1. Start the application:
   ```bash
   streamlit run main.py
   ```
2. Open your browser at `http://localhost:8501`
3. Upload a file or paste content
4. Get AI-generated descriptions
5. Ask questions about the content

## 🛠️ Technical Architecture
- **Frontend**: Streamlit
- **AI Engine**: Gemini 2.0 pro
- **Content Processing**: Custom utilities for each file type
- **Audio/Video**: Whisper model integration

## 📝 API Reference
```python
from omnidoc import process_file

# Basic usage
result = process_file(file_path)
description = result.get_description()
```

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## ⚠️ Known Limitations
- Video processing requires initial model download
- Large files (>100MB) may take longer to process
- API rate limits apply based on your Gemini API tier

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Support
- Create an issue for bug reports
- Join our [Discord community](https://discord.gg/yourdiscord)
- Email: support@yourdomain.com

## 🙏 Acknowledgments
- Gemini 2.0 pro
- Streamlit framework
- OpenAI Whisper
- All contributors

> _If you know, you know. OMNIDOC AI+ is built for developers who need fast, intelligent document analysis and Q&A—by devs, for devs._