import re
import codecs

with codecs.open('api.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Imports
text = text.replace('import sqlite3', 'import psycopg2\nfrom psycopg2.extras import RealDictCursor\nimport psycopg2.pool\nimport os')

# 2. Connection function
old_conn = '''def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn'''

new_conn = '''
DB_POOL = None
def init_db_pool():
    global DB_POOL
    DB_URL = os.environ.get('DATABASE_URL')
    if not DB_URL:
        print("WARNING: DATABASE_URL not set. PostgreSQl will fail if not provided.")
        # Fallback for local testing if needed
        DB_URL = 'postgresql://user:password@localhost/dbname'
    try:
        DB_POOL = psycopg2.pool.SimpleConnectionPool(1, 20, DB_URL)
        print("PostgreSQL connection pool initialized!")
    except Exception as e:
        print(f"Failed to initialize database pool: {e}")

def get_db_connection():
    global DB_POOL
    if not DB_POOL:
        init_db_pool()
    conn = DB_POOL.getconn()
    conn.autocommit = True
    return conn

def release_db_connection(conn):
    if DB_POOL and conn:
        DB_POOL.putconn(conn)
'''
text = text.replace(old_conn, new_conn.strip())

# Initialize DB on boot
if 'init_db_pool()' not in text:
    text = text.replace('q_client = None\n\n', 'q_client = None\n\ninit_db_pool()\n\n')

# 3. Handle cursors & rows
text = text.replace('c = conn.cursor()', 'c = conn.cursor(cursor_factory=RealDictCursor)')
text = text.replace('sqlite3.IntegrityError', 'psycopg2.IntegrityError')
# Remove any row_factory assignments if they exist elsewhere
text = text.replace('conn.row_factory = sqlite3.Row', '')

# 4. Handle ? -> %s
def replace_placeholders(match):
    # Regex finds: c.execute("...", (...))
    query = match.group(1).replace('?', '%s')
    return f'c.execute({query},{match.group(2)})'

# We need to be careful. Match strings inside c.execute("...") and the following args.
# For simplicity, let's just replace all `?` to `%s` where they appear in SQL statements.
# Finding all exact execute statements that had ?
statements = [
    ("UPDATE user_history SET answers = ? WHERE id = ?", "UPDATE user_history SET answers = %s WHERE id = %s"),
    ("INSERT INTO users (username, password_hash, role, analysis_count, is_premium) VALUES (?, ?, ?, 0, ?)", "INSERT INTO users (username, password_hash, role, analysis_count, is_premium) VALUES (%s, %s, %s, 0, %s) RETURNING id"),
    ("SELECT id, username, role, analysis_count, is_premium FROM users WHERE id = ?", "SELECT id, username, role, analysis_count, is_premium FROM users WHERE id = %s"),
    ("SELECT id, username, role, analysis_count, is_premium, password_hash FROM users WHERE username = ?", "SELECT id, username, role, analysis_count, is_premium, password_hash FROM users WHERE username = %s"),
    ("SELECT content_type, content, description, questions, answers, created_at, id, file_name, folder_name \n                 FROM user_history WHERE user_id = ? ORDER BY created_at DESC", "SELECT content_type, content, description, questions, answers, created_at, id, file_name, folder_name \n                 FROM user_history WHERE user_id = %s ORDER BY created_at DESC"),
    ("DELETE FROM user_history WHERE id = ?", "DELETE FROM user_history WHERE id = %s"),
    ("UPDATE user_history SET file_name = ? WHERE id = ?", "UPDATE user_history SET file_name = %s WHERE id = %s"),
    ("INSERT INTO user_history (user_id, content_type, content, description, questions, answers, file_name, folder_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", "INSERT INTO user_history (user_id, content_type, content, description, questions, answers, file_name, folder_name) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id"),
    ("SELECT id, username, analysis_count, created_at, role, is_premium FROM users ORDER BY created_at DESC", "SELECT id, username, analysis_count, created_at, role, is_premium FROM users ORDER BY created_at DESC"),
    ("SELECT id, username, is_premium FROM users WHERE id = ?", "SELECT id, username, is_premium FROM users WHERE id = %s"),
    ("UPDATE users SET is_premium = 1 WHERE id = ?", "UPDATE users SET is_premium = 1 WHERE id = %s")
]

for old, new in statements:
    text = text.replace(old, new)


# 5. Handle RETURNING id
text = text.replace('user_id = c.lastrowid', 'user_id = c.fetchone()["id"]')
text = text.replace('history_id = c.lastrowid', 'history_id = c.fetchone()["id"]')

# 6. Change conn.close() to release_db_connection(conn) everywhere EXCEPT when it's part of a loop maybe?
text = text.replace('conn.close()', 'release_db_connection(conn)')

# 7. Add initialization script for creating tables in postgres (since logic might be there)
# Just to be safe, creating tables using IF NOT EXISTS in postgres
init_db_postgres = """
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
    release_db_connection(conn)

check_db()
"""

text += "\n" + init_db_postgres

with codecs.open('api.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Migration script executed successfully.")
