import sqlite3
import uuid

def migrate():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    
    # Check if 'role' exists in 'users'
    try:
        c.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
    except sqlite3.OperationalError as e:
        print("users.role already exists or error:", e)

    try:
        c.execute("ALTER TABLE users ADD COLUMN analysis_count INTEGER DEFAULT 0")
    except sqlite3.OperationalError as e:
        print("users.analysis_count already exists or error:", e)

    try:
        c.execute("ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0")
    except sqlite3.OperationalError as e:
        print("users.is_premium already exists or error:", e)

    # Add shared_id to user_history for shareable links
    try:
        c.execute("ALTER TABLE user_history ADD COLUMN shared_id TEXT UNIQUE")
    except sqlite3.OperationalError as e:
        print("user_history.shared_id already exists or error:", e)
        
    conn.commit()
    conn.close()
    print("Migration successful")

if __name__ == "__main__":
    migrate()
