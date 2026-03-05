# OMNIDOC AI — Intelligent Document Intelligence Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Overview
OMNIDOC AI is a full-stack AI document intelligence platform. Upload PDFs, code, spreadsheets, images or paste a URL — get AI summaries, hybrid RAG-powered chat, and Studio content (slides, quizzes, flashcards, mind maps, and more).

## ✨ Key Features
- **Hybrid RAG Engine** — Dense (Qdrant) + Sparse (BM25) retrieval + cross-encoder reranking
- **Multi-Document Chat** — Ask questions across multiple documents at once
- **Studio** — Generate Audio Scripts, Slide Decks, Mind Maps, Quizzes, Flashcards, Infographics, Reports, Data Tables
- **Document History** — Auto-saved sessions with rename & folder organisation
- **Shareable Links** — Share any analysis via a public URL
- **Premium Tier** — Stripe-powered subscription with unlimited analyses
- **JWT Auth** — Secure bcrypt password hashing + JWT-protected admin routes
- **Responsive UI** — React + Framer Motion landing page + app dashboard

## 🛠️ Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Framer Motion |
| Backend | Python, Flask, SQLite |
| Vector DB | Qdrant (persistent, local) |
| AI | OpenRouter (GPT-4o-mini) |
| Embeddings | sentence-transformers (MiniLM-L6) |
| Auth | bcrypt + JWT |
| Payments | Stripe Checkout |

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- OpenRouter API key

### 1. Clone & Install Backend
```bash
git clone https://github.com/ruchitparmar11/OMNIDOC-AI-.git
cd OMNIDOC-AI-
pip install -r requirements.txt
```

### 2. Configure Secrets
```bash
# .streamlit/secrets.toml
OPENROUTER_API_KEY = "your_openrouter_key_here"
```

### 3. Start Backend
```bash
python api.py
# Flask runs on http://localhost:5000
```

### 4. Install & Start Frontend
```bash
cd frontend
npm install
npm run dev
# React runs on http://localhost:5173
```

### 5. Open the App
Visit `http://localhost:5173` — register an account (username `admin` gets admin privileges).

## 📁 Project Structure
```
OMNIDOC/
├── api.py              # Flask REST API
├── utils/              # PDF, DOCX, image, code extractors
├── qdrant_db/          # Persistent vector store
├── users.db            # SQLite user + history database
└── frontend/
    ├── src/
    │   ├── App.jsx         # Main dashboard
    │   ├── LandingPage.jsx # Marketing landing page
    │   ├── AdminPanel.jsx  # Admin dashboard
    │   └── SharedDocument.jsx
    └── .env            # VITE_API_BASE
```

## ⚠️ File Size Limit
Maximum upload size: **20 MB** per file.

## 📄 License
MIT License — see `LICENSE` for details.

## 📞 Support
- Issues: [GitHub Issues](https://github.com/ruchitparmar11/OMNIDOC-AI-/issues)
- LinkedIn: [Ruchit Parmar](https://www.linkedin.com/in/ruchit-parmar-16562229b)
- Email: ruchitparmar78@gmail.com
