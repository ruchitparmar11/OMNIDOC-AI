from dotenv import load_dotenv
load_dotenv()
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import psycopg2.pool
import os
import hashlib
import bcrypt
import jwt
from functools import wraps
import time
import tempfile
import json

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue, MatchAny
import csv
import io
import stripe
from openai import OpenAI
import httpx
import concurrent.futures
import requests
from bs4 import BeautifulSoup

# Extractors (assuming these exist from main.py)
from utils.extract_pdf import extract_text_from_pdf
from utils.extract_word import extract_text_from_word
from utils.extract_image import extract_text_from_image
from utils.extract_code import extract_text_from_code

app = Flask(__name__)
app.config["PROPAGATE_EXCEPTIONS"] = False
# Enable CORS broadly — allow all origins for all routes
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return Response(status=204)

# Safety-net: guarantee CORS headers on EVERY response (including error responses)
# Without this, when Flask crashes mid-request, the browser misreports the real error as "CORS blocked"
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.errorhandler(500)
def internal_error(e):
    resp = jsonify({"success": False, "message": f"Internal server error: {str(e)}"})
    resp.status_code = 500
    return resp

@app.errorhandler(413)
def request_too_large(e):
    resp = jsonify({"success": False, "message": "File too large. Maximum allowed size is 20 MB."})
    resp.status_code = 413
    return resp

@app.errorhandler(405)
def method_not_allowed(e):
    resp = jsonify({"success": False, "message": "Method not allowed."})
    resp.status_code = 405
    return resp

@app.errorhandler(Exception)
def handle_unexpected_error(e):
    print(f"Unhandled server error: {e}")
    resp = jsonify({"success": False, "message": str(e)})
    resp.status_code = 500
    return resp

# Simple parser for secrets.toml
API_KEY = None
try:
    with open(".streamlit/secrets.toml", "r") as f:
        for line in f:
            if "OPENROUTER_API_KEY" in line:
                API_KEY = line.split("=")[1].strip().strip('"').strip("'")
                break
except Exception as e:
    # If not found in file, try to grab from the system's environment variables (e.g. Render/Vercel)
    API_KEY = os.environ.get("OPENROUTER_API_KEY")
    if not API_KEY:
        print(f"Failed to load OpenRouter API key from secrets or environment.")

client = None
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
if API_KEY:
    http_client = httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0))
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=API_KEY,
        http_client=http_client,
        default_headers={
            "HTTP-Referer": FRONTEND_URL,
            "X-Title": "OmniDoc AI React",
        }
    )

def generate_with_retry(prompt, system_prompt="You are OmniDoc AI, an expert document assistant. Provide the most critical highlights.", model="openai/gpt-4o-mini", max_retries=3):
    if not client:
        return "Warning: AI API not initialized. The prompt was: " + prompt[:100] + "..."
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            time.sleep(1)
            if attempt == max_retries - 1:
                return f"Error: Failed to generate response ({e})"

def chunk_text(text, chunk_size=2000, overlap=300):
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunks.append(text[start:end])
        start += (chunk_size - overlap)
    return chunks

# Lazy load our neural embedding model
embedder = None
reranker = None

def get_embedder():
    global embedder
    if embedder is None:
        from sentence_transformers import SentenceTransformer
        # MiniLM is incredibly fast and lightweight for document semantic search
        embedder = SentenceTransformer('all-MiniLM-L6-v2')
    return embedder

def get_reranker():
    global reranker
    if reranker is None:
        from sentence_transformers import CrossEncoder
        # A lightweight cross-encoder for extremely accurate reranking
        reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
    return reranker

q_client = None
qdrant_initialized = False

def get_q_client():
    global q_client, qdrant_initialized
    if not qdrant_initialized:
        qdrant_initialized = True
        try:
            q_client = QdrantClient(path="qdrant_db")
            try:
                q_client.get_collection("omnidoc_chunks")
            except Exception:
                q_client.create_collection(
                    collection_name="omnidoc_chunks",
                    vectors_config=VectorParams(size=384, distance=Distance.COSINE)
                )
        except Exception as e:
            print(f"Warning: Failed to init Qdrant ({e})")
            q_client = None
    return q_client

def retrieve_relevant_chunks(question, history_ids, default_text, top_k=5):
    client_q = get_q_client()
    if not client_q:
        return default_text[:15000] # Fallback
        
    try:
        # We can pass one or multiple history_ids for Multi-Document Search
        if isinstance(history_ids, int):
            history_ids = [history_ids]
            
        # Check if there are any points for the given history_ids before loading heavy models
        count_result = client_q.count(
            collection_name="omnidoc_chunks",
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="history_id",
                        match=MatchAny(any=history_ids)
                    )
                ]
            ),
            exact=True
        )
        if count_result.count == 0:
            return default_text[:15000] # No relevant documents found, return fallback
            
        model = get_embedder()
        question_embedding = model.encode([question], convert_to_numpy=True)[0]
        
        # 1. DENSE RETRIEVAL (Qdrant Database) - Fetches directly from disk!
        dense_top_k = 15
        search_result = client_q.search(
            collection_name="omnidoc_chunks",
            query_vector=question_embedding.tolist(),
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="history_id",
                        match=MatchAny(any=history_ids)
                    )
                ]
            ),
            limit=dense_top_k
        )
        
        if not search_result:
             return default_text[:15000]
             
        dense_chunks = [hit.payload['text'] for hit in search_result]
        
        # 2. SPARSE RETRIEVAL (BM25) - Done on the candidates
        from rank_bm25 import BM25Okapi
        import numpy as np
        tokenized_chunks = [chunk.lower().split() for chunk in dense_chunks]
        bm25 = BM25Okapi(tokenized_chunks)
        tokenized_query = question.lower().split()
        bm25_scores = bm25.get_scores(tokenized_query)
        sparse_indices = np.argsort(bm25_scores)[::-1].tolist()
        
        # 3. RECIPROCAL RANK FUSION (RRF)
        rrf_scores = {}
        rrf_k = 60
        
        for rank, hit in enumerate(search_result):
            # idx tracking within candidate list
            rrf_scores[rank] = rrf_scores.get(rank, 0) + 1 / (rrf_k + rank + 1)
            
        for rank, idx in enumerate(sparse_indices):
            rrf_scores[idx] = rrf_scores.get(idx, 0) + 1 / (rrf_k + rank + 1)
            
        hybrid_indices = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)
        
        # 4. RERANKING (Cross-Encoder)
        rerank_model = get_reranker()
        cross_inp = [[question, dense_chunks[i]] for i in hybrid_indices]
        cross_scores = rerank_model.predict(cross_inp)
        
        reranked_pairs = sorted(zip(hybrid_indices, cross_scores), key=lambda x: x[1], reverse=True)
        final_top_indices = [pair[0] for pair in reranked_pairs[:top_k]]
        
        # Sort by chunk_index to keep chronlogical order from the document
        final_top_hits = [search_result[i] for i in final_top_indices]
        final_top_hits.sort(key=lambda hit: hit.payload.get('chunk_index', 0))
        
        relevant_context = "\n\n...[SNIP]...\n\n".join([hit.payload['text'] for hit in final_top_hits])
        return relevant_context
    except Exception as e:
        print(f"Advanced RAG Pipeline Error: {e}")
        return default_text[:15000]

def generate_chat_stream(messages, history_id, question, chat_history, model="openai/gpt-4o-mini", max_retries=3):
    """Stream AI response with keepalive pings to prevent Render's 30s idle timeout."""
    import queue
    import threading

    full_answer = ""
    if not client:
        yield f"data: {json.dumps({'content': 'Warning: AI API not initialized.'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    output_queue = queue.Queue()

    def run_stream():
        for attempt in range(max_retries):
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.3,
                    stream=True
                )
                for chunk in response:
                    if chunk.choices[0].delta.content is not None:
                        output_queue.put(("data", chunk.choices[0].delta.content))
                output_queue.put(("done", None))
                return
            except Exception as e:
                time.sleep(1)
                if attempt == max_retries - 1:
                    output_queue.put(("error", str(e)))
                    return

    t = threading.Thread(target=run_stream, daemon=True)
    t.start()

    while True:
        try:
            msg_type, content = output_queue.get(timeout=15)  # 15s keepalive interval
            if msg_type == "data":
                full_answer += content
                yield f"data: {json.dumps({'content': content})}\n\n"
            elif msg_type == "done":
                break
            elif msg_type == "error":
                yield f"data: {json.dumps({'content': f'Error: {content}'})}\n\n"
                break
        except queue.Empty:
            # Send a keepalive SSE comment to prevent Render's idle timeout
            yield ": keepalive\n\n"
            if not t.is_alive():
                break

    if full_answer:
        chat_history.append({"role": "user", "content": question})
        chat_history.append({"role": "ai", "content": full_answer})
        try:
            conn_chat = get_db_connection()
            try:
                c_chat = conn_chat.cursor(cursor_factory=RealDictCursor)
                c_chat.execute("UPDATE user_history SET answers = %s WHERE id = %s", (json.dumps(chat_history), history_id))
                conn_chat.commit()
            finally:
                release_db_connection(conn_chat)
        except Exception:
            pass

    yield "data: [DONE]\n\n"

def hash_password(password):
    """Hash a password with bcrypt (new accounts)."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def check_password(password, stored_hash):
    """Verify bcrypt or fallback sha256 hashes."""
    try:
        return bcrypt.checkpw(password.encode(), stored_hash.encode())
    except Exception:
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest() == stored_hash

JWT_SECRET = os.environ.get("JWT_SECRET", "omnidoc-supersecret-dev-key-2026")

def make_token(user_id, role):
    return jwt.encode({"user_id": user_id, "role": role}, JWT_SECRET, algorithm="HS256")

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if payload.get("role") != "admin":
                return jsonify({"success": False, "message": "Admin access required"}), 403
        except Exception:
            return jsonify({"success": False, "message": "Invalid or missing token"}), 401
        return f(*args, **kwargs)
    return decorated

db_pool = None

def init_db_pool():
    global db_pool
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        try:
            db_pool = psycopg2.pool.ThreadedConnectionPool(1, 10, db_url)
            print("Successfully initialized PostgreSQL connection pool.")
        except Exception as e:
            print(f"Error initializing connection pool: {e}")

init_db_pool()

def get_db_connection():
    if db_pool:
        try:
            return db_pool.getconn()
        except Exception as e:
            print(f"Error getting connection from pool: {e}")
    # Fallback to direct connection if pool is exhausted or uninitialized
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        return psycopg2.connect(db_url)
    raise Exception("DATABASE_URL is not set.")

def release_db_connection(conn):
    if db_pool and conn:
        try:
            db_pool.putconn(conn)
            return
        except Exception:
            pass
    if conn:
        try:
            conn.close()
        except Exception:
            pass

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
        
    role = 'admin' if username.lower() == 'admin' else 'user'
    is_premium = 1 if role == 'admin' else 0

    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    try:
        c.execute("INSERT INTO users (username, password_hash, role, analysis_count, is_premium) VALUES (%s, %s, %s, 0, %s) RETURNING id", 
                  (username, hash_password(password), role, is_premium))
        conn.commit()
        
        # Fetch the newly created user
        user_id = c.fetchone()["id"]
        c.execute("SELECT id, username, role, analysis_count, is_premium FROM users WHERE id = %s", (user_id,))
        user = c.fetchone()
        
        token = make_token(user_id, role)
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "role": user['role'],
                "analysis_count": user['analysis_count'],
                "is_premium": bool(user['is_premium'])
            }
        })
    except psycopg2.IntegrityError:
        return jsonify({"success": False, "message": "Username already exists"}), 409
    finally:
        release_db_connection(conn)

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT id, username, role, analysis_count, is_premium, password_hash FROM users WHERE username = %s", (username,))
    user = c.fetchone()
    if user and not check_password(password, user["password_hash"]):
        user = None
    release_db_connection(conn)
    
    if user:
        token = make_token(user['id'], user['role'])
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "role": user['role'],
                "analysis_count": user['analysis_count'],
                "is_premium": bool(user['is_premium'])
            }
        })
    return jsonify({"success": False, "message": "Invalid username or password"}), 401

@app.route('/api/history/<int:user_id>', methods=['GET'])
def get_user_history(user_id):
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("""SELECT content_type, content, description, questions, answers, created_at, id, file_name, folder_name 
                 FROM user_history WHERE user_id = %s ORDER BY created_at DESC""", (user_id,))
    history = [dict(row) for row in c.fetchall()]
    release_db_connection(conn)
    return jsonify({"success": True, "history": history})

@app.route('/api/history/<int:history_id>/rename', methods=['PATCH'])
def rename_history(history_id):
    data = request.json
    new_name = data.get('name', '').strip()
    if not new_name:
        return jsonify({"success": False, "message": "Name required"}), 400
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("UPDATE user_history SET file_name = %s WHERE id = %s", (new_name, history_id))
    conn.commit()
    release_db_connection(conn)
    return jsonify({"success": True})

@app.route('/api/history/<int:history_id>', methods=['DELETE'])
def delete_history(history_id):
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("DELETE FROM user_history WHERE id = %s", (history_id,))
    conn.commit()
    release_db_connection(conn)
    return jsonify({"success": True})

@app.route('/api/analyze', methods=['POST'])
def analyze_content():
    user_id = request.form.get('user_id')
    output_type = request.form.get('output_type', 'Summary')
    text_input = request.form.get('text', '')
    folder_name = request.form.get('folder_name', 'Recent')

    if not user_id:
        return jsonify({"success": False, "message": "User ID required"}), 400

    conn = get_db_connection()
    try:
        c = conn.cursor(cursor_factory=RealDictCursor)
        c.execute("SELECT role, analysis_count, is_premium FROM users WHERE id = %s", (user_id,))
        user = c.fetchone()
    finally:
        release_db_connection(conn)
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    role = user['role']
    is_premium = bool(user['is_premium'])
    analysis_count = user['analysis_count']

    if role != 'admin' and not is_premium and analysis_count >= 4:
        return jsonify({"success": False, "message": "Free tier limit reached. Please upgrade to Premium."}), 403
    
    # Extract history_id correctly without throwing exceptions if it's 'null' string
    history_id = None
    if request.form.get('history_id') and str(request.form.get('history_id')).strip() != 'null':
        try:
            history_id = int(request.form.get('history_id'))
        except:
            history_id = None

    if history_id and output_type != "Summary":
        # Studio generation on an EXISTING document! 
        # Skip extraction, reuse the content, and append to the existing DB row
        conn_studio = get_db_connection()
        try:
            c_studio = conn_studio.cursor(cursor_factory=RealDictCursor)
            c_studio.execute("SELECT content, answers, file_name, content_type FROM user_history WHERE id = %s AND user_id = %s", (history_id, user_id))
            row = c_studio.fetchone()
        finally:
            release_db_connection(conn_studio)
            
        if not row:
            return jsonify({"success": False, "message": "Original document not found"}), 404
            
        content = row['content']
        answers_str = row['answers']
        file_name = row['file_name']
        content_type = row['content_type']
        
        # Determine persona
        persona = "You are OmniDoc AI, an expert document assistant. Provide the most critical highlights."
        if content_type in ['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json']:
            persona = "You are a Senior Principal Software Engineer. Analyze the provided code with extreme technical precision, highlighting design patterns, potential bugs, and architectural decisions."
        elif content_type == 'csv':
            persona = "You are an Elite Data Scientist and Data Analyst. Analyze this raw data, extract key statistical trends, and explain the relationships clearly."
        elif content_type in ['pdf', 'doc', 'docx']:
            persona = "You are an expert Document Analyst and Legal/Business Consultant. Read this document, extract the core arguments, pinpoint critical clauses, and provide a high-level briefing."
            
        # Determine prompt
        prompt = ""
        if output_type == "audio":
            prompt = f"Write an engaging, conversational podcast script discussing the key points of this document:\n\n{content[:15000]}"
        elif output_type == "slide":
            prompt = f"Create a comprehensive slide deck presentation outline for this document. For each slide, provide a Title and Bullet Points:\n\n{content[:15000]}"
        elif output_type == "video":
            prompt = f"Write a detailed storyboard and script for an educational YouTube video explaining the contents of this document:\n\n{content[:15000]}"
        elif output_type == "mindmap":
            prompt = f"Extract a structured hierarchical mind map from this document. Use clear indentation and bullet points to map out core concepts, subtopics, and relationships:\n\n{content[:15000]}"
        elif output_type == "reports":
            prompt = f"Generate a formal, highly structured business report summarizing this document's findings, including an executive summary, methodology (if applicable), core findings, and recommendations:\n\n{content[:15000]}"
        elif output_type == "flashcards":
            prompt = f"Create 10 study flashcards based on this document. Format them strictly as:\nQ: [Question]\nA: [Answer]\n\n{content[:15000]}"
        elif output_type == "quiz":
            prompt = f"Create a multiple-choice quiz with 5 challenging questions based on this document. Provide 4 options per question and include the correct answers at the end:\n\n{content[:15000]}"
        elif output_type == "infographic":
            prompt = f"Design a text-based blueprint for an infographic based on this document. Propose main section headers, key statistics, bullet points, and suggestions for visual icons/charts:\n\n{content[:15000]}"
        elif output_type == "datatable":
            prompt = f"Extract the key entities, metrics, categories, or factual properties from this document and organize them into a clean, comprehensive Markdown table:\n\n{content[:15000]}"
        else:
            prompt = f"Please provide a {output_type} of the following document content:\n\n{content[:15000]}"
            
        description = generate_with_retry(prompt, persona)
        
        # Append to answers
        try:
            chat_history = json.loads(answers_str) if answers_str else []
        except:
            chat_history = []
            
        # Filter existing studio of the same type to avoid bloat (optional, but good for keeping history clean)
        chat_history = [msg for msg in chat_history if not (msg.get('role') == 'studio' and msg.get('feature') == output_type)]
        
        chat_history.append({
            "role": "studio",
            "feature": output_type,
            "content": description
        })
        
        conn_studio = get_db_connection()
        try:
            c_studio = conn_studio.cursor(cursor_factory=RealDictCursor)
            c_studio.execute("UPDATE user_history SET answers = %s WHERE id = %s", (json.dumps(chat_history), history_id))
            conn_studio.commit()
        finally:
            release_db_connection(conn_studio)
        
        return jsonify({
            "success": True, 
            "data": {
                "id": history_id,
                "description": description,
                "feature": output_type
            }
        })

    # === STANDARD ANALYSIS (New Document) ===
    content = text_input
    content_type = "text"
    file_name = None

    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
    if 'file' in request.files:
        file = request.files['file']
        if file.filename:
            file.seek(0, 2)
            file_size = file.tell()
            file.seek(0)
            if file_size > MAX_FILE_SIZE:
                return jsonify({"success": False, "message": f"File too large. Maximum allowed size is 20 MB (your file: {file_size // (1024*1024)} MB)."}), 413
            file_name = file.filename
            content_type = file.filename.split('.')[-1].lower()
            
            # Save file temporarily to extract text
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{content_type}") as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
                
            try:
                if content_type == 'pdf':
                    content = extract_text_from_pdf(tmp_path)
                elif content_type in ['doc', 'docx']:
                    content = extract_text_from_word(tmp_path)
                elif content_type in ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']:
                    content = extract_text_from_image(tmp_path)
                elif content_type in ['py', 'json', 'txt', 'js', 'html', 'css', 'jsx', 'ts', 'tsx', 'csv', 'md', 'env', 'xml', 'yaml', 'yml', 'toml', 'ini', 'sh', 'bat']:
                    content = extract_text_from_code(tmp_path)
                else:
                    # Fallback: try to read as plain text
                    try:
                        with open(tmp_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                    except Exception:
                        return jsonify({"success": False, "message": f"Unsupported file type: .{content_type}"}), 400
                
                # If extraction returned empty, try plain text fallback
                if not content or not content.strip():
                    try:
                        with open(tmp_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read().strip()
                    except Exception:
                        pass
                
                if not content or not content.strip():
                    return jsonify({"success": False, "message": f"Could not extract any text from this {content_type.upper()} file. The file may be empty, password-protected, or contain only images without OCR support."}), 400
                    
            except Exception as e:
                print(f"File extraction error for {content_type}: {e}")
                return jsonify({"success": False, "message": f"File extraction error ({content_type.upper()}): {str(e)}"}), 500
            finally:
                os.unlink(tmp_path)
    # If no file was uploaded, check if the text input is actually a URL
    elif text_input.strip().startswith('http://') or text_input.strip().startswith('https://'):
        url = text_input.strip()
        try:
            # Mask as a standard browser to avoid basic blocks
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            # Extract text carefully, dropping scripts and styles
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.extract()
            content = soup.get_text(separator='\n', strip=True)
            content_type = "url"
            file_name = url
        except Exception as e:
            return jsonify({"success": False, "message": f"URL scraping failed: {str(e)}"}), 500
    # Web Search Agent Feature
    elif text_input.strip().startswith('/search '):
        query = text_input.replace('/search ', '').strip()
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
                
            if not results:
                content = f"No search results found for query: {query}"
            else:
                content = f"Web Search Context for query '{query}':\n\n"
                for i, r in enumerate(results):
                    content += f"[{i+1}] {r.get('title')}\nSnippet: {r.get('body')}\nURL: {r.get('href')}\n\n"
            content_type = "web_search"
            file_name = f"Search: {query[:30]}..."
        except Exception as e:
            return jsonify({"success": False, "message": f"Web Search failed. Please install 'duckduckgo_search' if missing. Error: {str(e)}"}), 500
            
    if not content:
        return jsonify({"success": False, "message": "No content provided to analyze"}), 400

    # Determine personalized AI persona based on document type
    persona = "You are OmniDoc AI, an expert document assistant. Provide the most critical highlights."
    if content_type in ['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json']:
        persona = "You are a Senior Principal Software Engineer. Analyze the provided code with extreme technical precision, highlighting design patterns, potential bugs, and architectural decisions."
    elif content_type == 'csv':
        persona = "You are an Elite Data Scientist and Data Analyst. Analyze this raw data, extract key statistical trends, and explain the relationships clearly."
    elif content_type in ['pdf', 'doc', 'docx']:
        persona = "You are an expert Document Analyst and Legal/Business Consultant. Read this document, extract the core arguments, pinpoint critical clauses, and provide a high-level briefing."

    # Determine custom advanced prompt based on output_type
    if output_type == "audio":
        prompt = f"Write an engaging, conversational podcast script discussing the key points of this document:\n\n{content[:15000]}"
    elif output_type == "slide":
        prompt = f"Create a comprehensive slide deck presentation outline for this document. For each slide, provide a Title and Bullet Points:\n\n{content[:15000]}"
    elif output_type == "video":
        prompt = f"Write a detailed storyboard and script for an educational YouTube video explaining the contents of this document:\n\n{content[:15000]}"
    elif output_type == "mindmap":
        prompt = f"Extract a structured hierarchical mind map from this document. Use clear indentation and bullet points to map out core concepts, subtopics, and relationships:\n\n{content[:15000]}"
    elif output_type == "reports":
        prompt = f"Generate a formal, highly structured business report summarizing this document's findings, including an executive summary, methodology (if applicable), core findings, and recommendations:\n\n{content[:15000]}"
    elif output_type == "flashcards":
        prompt = f"Create 10 study flashcards based on this document. Format them strictly as:\nQ: [Question]\nA: [Answer]\n\n{content[:15000]}"
    elif output_type == "quiz":
        prompt = f"Create a multiple-choice quiz with 5 challenging questions based on this document. Provide 4 options per question and include the correct answers at the end:\n\n{content[:15000]}"
    elif output_type == "infographic":
        prompt = f"Design a text-based blueprint for an infographic based on this document. Propose main section headers, key statistics, bullet points, and suggestions for visual icons/charts:\n\n{content[:15000]}"
    elif output_type == "datatable":
        prompt = f"Extract the key entities, metrics, categories, or factual properties from this document and organize them into a clean, comprehensive Markdown table:\n\n{content[:15000]}"
    else:
        prompt = f"Please provide a {output_type} of the following document content:\n\n{content[:15000]}"
    questions_prompt = f"Based on this content, suggest 3 highly analytical follow-up questions I should ask about it:\n{content[:10000]}"
    
    # Run API calls concurrently to slice processing time in half
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_desc = executor.submit(generate_with_retry, prompt, persona)
        future_ques = executor.submit(generate_with_retry, questions_prompt, persona)
        description = future_desc.result()
        questions = future_ques.result()
    
    answers_str = None
    if output_type not in ["Summary", "Detailed", "Bullet Points", "Deep Dive"]:
        answers_str = json.dumps([{"role": "studio", "feature": output_type, "content": description}])

    try:
        conn_insert = get_db_connection()
        c_insert = conn_insert.cursor(cursor_factory=RealDictCursor)
        c_insert.execute("""INSERT INTO user_history (user_id, content_type, content, description, questions, answers, file_name, folder_name) 
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""", 
                     (user_id, content_type, content, description, questions, answers_str, file_name, folder_name))
        entry_id = c_insert.fetchone()['id']
        
        c_insert.execute("UPDATE users SET analysis_count = analysis_count + 1 WHERE id = %s", (user_id,))
        conn_insert.commit()
        
        c_insert.execute("SELECT analysis_count FROM users WHERE id = %s", (user_id,))
        updated_count = c_insert.fetchone()['analysis_count']
    except Exception as db_err:
        print(f"DB Error during insert: {db_err}")
        if conn_insert:
            conn_insert.rollback()
        raise
    finally:
        if 'conn_insert' in locals():
            release_db_connection(conn_insert)

    # Store document embeddings directly into Qdrant for persistent RAG querying!
    # Moved OUTSIDE the request thread to prevent holding the connection and blocking the frontend!
    def embed_in_background(text_content, hid, fname):
        try:
            client_q = get_q_client()
            if client_q and text_content:
                import uuid
                chunks = chunk_text(text_content, chunk_size=1500, overlap=300)
                if chunks:
                     emb_model = get_embedder()
                     embeddings = emb_model.encode(chunks, convert_to_numpy=True)
                     points = []
                     for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                         points.append(
                             PointStruct(
                                 id=str(uuid.uuid4()),
                                 vector=emb.tolist(),
                                 payload={
                                     "history_id": hid, 
                                     "text": chunk, 
                                     "chunk_index": idx,
                                     "file_name": fname
                                 }
                             )
                         )
                     client_q.upsert(collection_name="omnidoc_chunks", points=points)
        except Exception as q_err:
            print(f"Warning: Qdrant embedding failed ({q_err})")

    import threading
    t = threading.Thread(target=embed_in_background, args=(content, entry_id, file_name))
    t.daemon = True
    t.start()

    return jsonify({
        "success": True, 
        "data": {
            "id": entry_id,
            "description": description,
            "questions": questions.split('\n'),
            "fileName": file_name,
            "analysis_count": updated_count,
            "content": content
        }
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    history_id = data.get('history_id')
    history_ids = data.get('history_ids')
    question = data.get('question')
    
    if not (history_id or history_ids) or not question:
        return jsonify({"success": False, "message": "Missing history_id(s) or question"}), 400
        
    if not history_ids:
        history_ids = [history_id]

    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    
    placeholders = ','.join('%s' for _ in history_ids)
    c.execute(f"SELECT id, content, answers, content_type FROM user_history WHERE id IN ({placeholders})", tuple(history_ids))
    rows = c.fetchall()
    
    if not rows:
        release_db_connection(conn)
        return jsonify({"success": False, "message": "History not found"}), 404
        
    combined_content = "\n\n--- NEXT DOCUMENT ---\n\n".join([r['content'] for r in rows])
    content_type = rows[0]['content_type'] if rows[0]['content_type'] else 'txt'
    
    answers_str = rows[0]['answers']  # Store answers in the first document for simplicity

    if answers_str:
        try:
            raw_history = json.loads(answers_str)
            # Filter out studio entries - they are not valid OpenAI message roles
            chat_history = [m for m in raw_history if m.get('role') in ('user', 'ai', 'assistant')]
        except json.JSONDecodeError:
            chat_history = []
    else:
        chat_history = []

    release_db_connection(conn)

    # Determine personalized AI persona based on document type
    persona = "You are OmniDoc AI, an expert document assistant. You are answering a user's questions based on the document."
    if content_type in ['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json']:
        persona = "You are a Senior Principal Software Engineer. Answer the user's questions about the provided code with extreme technical precision, highlighting design patterns, potential bugs, and architectural decisions."
    elif content_type == 'csv':
        persona = "You are an Elite Data Scientist and Data Analyst. Answer the user's questions about the raw data, extract key statistical trends, and explain the relationships clearly."
    elif content_type in ['pdf', 'doc', 'docx']:
        persona = "You are an expert Document Analyst and Legal/Business Consultant. Answer the user's questions about the document, extract the core arguments, pinpoint critical clauses, and provide high-level briefings."

    def stream_with_rag():
        """Do RAG context retrieval + AI streaming all in one generator.
        This ensures no blocking happens before the HTTP streaming response starts.
        RAG has a 10s timeout so Render cold-start never freezes the request."""
        import concurrent.futures as cf

        # Attempt RAG with a hard 10-second timeout so Render cold-start never hangs us
        rag_context = combined_content[:15000]  # safe default
        try:
            with cf.ThreadPoolExecutor(max_workers=1) as ex:
                future = ex.submit(retrieve_relevant_chunks, question, history_ids, combined_content, 5)
                rag_context = future.result(timeout=10)[:25000]
        except Exception:
            pass  # timeout or error → use plain text fallback

        # Build message list with the resolved context
        messages = [
            {"role": "system", "content": f"{persona}\n\nDOCUMENT CONTEXT (retrieved snippets):\n{rag_context}"}
        ]
        for msg in chat_history:
            role = 'assistant' if msg.get('role') in ('ai', 'assistant') else 'user'
            content_msg = msg.get('content', '')
            if content_msg:
                messages.append({"role": role, "content": content_msg})
        messages.append({"role": "user", "content": question})

        yield from generate_chat_stream(messages, history_ids[0], question, chat_history)

    # Will save the chat stream to the first history_id passed
    # Explicit CORS headers needed because browsers block SSE cross-origin without them
    response = Response(
        stream_with_rag(),
        mimetype='text/event-stream'
    )
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'  # Disables Nginx/proxy buffering on Render
    return response

import uuid

@app.route('/api/share/<int:history_id>', methods=['POST'])
def share_history(history_id):
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT shared_id FROM user_history WHERE id = %s", (history_id,))
    row = c.fetchone()
    
    if not row:
        release_db_connection(conn)
        return jsonify({"success": False, "message": "History not found"}), 404
        
    shared_id = row['shared_id']
    if not shared_id:
        shared_id = str(uuid.uuid4())
        c.execute("UPDATE user_history SET shared_id = %s WHERE id = %s", (shared_id, history_id))
        conn.commit()
        
    release_db_connection(conn)
    return jsonify({"success": True, "shared_id": shared_id})

@app.route('/api/shared/<shared_id>', methods=['GET'])
def get_shared_history(shared_id):
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT file_name, content_type, description, questions, answers, created_at FROM user_history WHERE shared_id = %s", (shared_id,))
    row = c.fetchone()
    release_db_connection(conn)
    
    if not row:
        return jsonify({"success": False, "message": "Shared document not found"}), 404
        
    return jsonify({"success": True, "data": dict(row)})

@app.route('/api/admin/users', methods=['GET'])
@require_admin
def admin_users():
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT id, username, role, analysis_count, is_premium FROM users ORDER BY id DESC")
    users = [dict(r) for r in c.fetchall()]
    release_db_connection(conn)
    return jsonify({"success": True, "users": users})

@app.route('/api/admin/history', methods=['GET'])
@require_admin
def admin_history():
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT h.id, h.content_type, h.file_name, h.created_at, u.username as user FROM user_history h JOIN users u ON h.user_id = u.id ORDER BY h.created_at DESC LIMIT 100")
    history = [dict(r) for r in c.fetchall()]
    release_db_connection(conn)
    return jsonify({"success": True, "history": history})

@app.route('/api/admin/export', methods=['GET'])
@require_admin
def admin_export_csv():
    # In a real app, verify admin role here via token/session
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT id, username, role, analysis_count, is_premium FROM users ORDER BY id DESC")
    users = c.fetchall()
    release_db_connection(conn)

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['ID', 'Username', 'Role', 'Analysis Count', 'Premium Status'])
    for u in users:
        cw.writerow([u['id'], u['username'], u['role'], u['analysis_count'], 'Yes' if u['is_premium'] else 'No'])

    output = si.getvalue()
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=omnidoc_users.csv"}
    )

# Configure Stripe API Key here (using a placeholder or standard test fallback)
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

@app.route('/api/create-checkout-session', methods=['POST'])
def create_checkout_session():
    try:
        data = request.json
        user_id = data.get('user_id')
        
        FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        # If no stripe key is provided, we simulate the success via direct redirect so the app doesn't break
        if not stripe.api_key:
            return jsonify({
                "success": True, 
                "url": f"{FRONTEND_URL}/?success=true&user_id={user_id}"
            })

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'OMNIDOC AI Premium',
                        'description': 'Unlimited AI Document Analysis and Vector RAG Search',
                    },
                    'unit_amount': 1500, # $15.00
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{FRONTEND_URL}/?success=true&user_id={user_id}",
            cancel_url=f"{FRONTEND_URL}/?canceled=true",
        )
        return jsonify({"success": True, "url": session.url})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/user/checkout-success', methods=['POST'])
def checkout_success():
    data = request.json
    user_id = data.get('user_id')
    
    # Normally, this is handled by a Secure Stripe Webhook. 
    # For local testing, we update the DB when the Frontend redirects back.
    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("UPDATE users SET is_premium = 1 WHERE id = %s", (user_id,))
    conn.commit()
    release_db_connection(conn)
    return jsonify({"success": True})

if __name__ == '__main__':
    # Run the Flask app on port 5000
    app.run(host='0.0.0.0', port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")


def check_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            analysis_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_premium INTEGER DEFAULT 0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            content_type VARCHAR(50),
            content TEXT,
            description TEXT,
            questions TEXT,
            answers TEXT,
            file_name TEXT,
            folder_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    release_db_connection(conn)

check_db()
