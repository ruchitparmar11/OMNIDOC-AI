import re

def fix():
    with open('api.py', 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. First DB interaction (User Check)
    user_check_original = """    conn = get_db_connection()
    c = conn.cursor(cursor_factory=RealDictCursor)
    c.execute("SELECT role, analysis_count, is_premium FROM users WHERE id = %s", (user_id,))
    user = c.fetchone()
    
    if not user:
        release_db_connection(conn)
        return jsonify({"success": False, "message": "User not found"}), 404

    role = user['role']
    is_premium = bool(user['is_premium'])
    analysis_count = user['analysis_count']

    if role != 'admin' and not is_premium and analysis_count >= 4:
        release_db_connection(conn)
        return jsonify({"success": False, "message": "Free tier limit reached. Please upgrade to Premium."}), 403"""
        
    user_check_fixed = """    conn = get_db_connection()
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
        return jsonify({"success": False, "message": "Free tier limit reached. Please upgrade to Premium."}), 403"""

    code = code.replace(user_check_original, user_check_fixed)

    # 2. Existing Document Studio DB check
    studio_check_original = """        # (We already have an active conn)
        c.execute("SELECT content, answers, file_name, content_type FROM user_history WHERE id = %s AND user_id = %s", (history_id, user_id))
        row = c.fetchone()
        if not row:
            release_db_connection(conn)
            return jsonify({"success": False, "message": "Original document not found"}), 404"""

    studio_check_fixed = """        conn_studio = get_db_connection()
        try:
            c_studio = conn_studio.cursor(cursor_factory=RealDictCursor)
            c_studio.execute("SELECT content, answers, file_name, content_type FROM user_history WHERE id = %s AND user_id = %s", (history_id, user_id))
            row = c_studio.fetchone()
        finally:
            release_db_connection(conn_studio)
            
        if not row:
            return jsonify({"success": False, "message": "Original document not found"}), 404"""

    code = code.replace(studio_check_original, studio_check_fixed)

    # 3. Existing Document Studio DB Update
    studio_update_original = """        c.execute("UPDATE user_history SET answers = %s WHERE id = %s", (json.dumps(chat_history), history_id))
        conn.commit()
        release_db_connection(conn)"""

    studio_update_fixed = """        conn_studio = get_db_connection()
        try:
            c_studio = conn_studio.cursor(cursor_factory=RealDictCursor)
            c_studio.execute("UPDATE user_history SET answers = %s WHERE id = %s", (json.dumps(chat_history), history_id))
            conn_studio.commit()
        finally:
            release_db_connection(conn_studio)"""

    code = code.replace(studio_update_original, studio_update_fixed)

    # 4. Standard Analysis DB Insert
    standard_insert_original = """    # (We already have an active conn from the top of the function)
    c.execute(\"\"\"INSERT INTO user_history (user_id, content_type, content, description, questions, answers, file_name, folder_name) 
                 VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id\"\"\", (user_id, content_type, content, description, questions, answers_str, file_name, folder_name))
    entry_id = c.fetchone()['id']
    
    # Store document embeddings directly into Qdrant for persistent RAG querying!
    client_q = get_q_client()
    if client_q and content:
        import uuid
        chunks = chunk_text(content, chunk_size=1500, overlap=300)
        if chunks:
             emb_model = get_embedder()
             embeddings = emb_model.encode(chunks, convert_to_numpy=True)
             points = []
             for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                 points.append(
                     PointStruct(
                         id=str(uuid.uuid4()),
                         vector=emb.tolist(),
                         payload={
                             "history_id": entry_id, 
                             "text": chunk, 
                             "chunk_index": i,
                             "file_name": file_name
                         }
                     )
                 )
             client_q.upsert(collection_name="omnidoc_chunks", points=points)
             
    # Increment analysis count
    c.execute("UPDATE users SET analysis_count = analysis_count + 1 WHERE id = %s", (user_id,))
    conn.commit()
    
    # Fetch updated user explicitly over to send to client
    c.execute("SELECT analysis_count FROM users WHERE id = %s", (user_id,))
    updated_count = c.fetchone()['analysis_count']
    
    release_db_connection(conn)"""

    standard_insert_fixed = """    try:
        conn_insert = get_db_connection()
        c_insert = conn_insert.cursor(cursor_factory=RealDictCursor)
        c_insert.execute(\"\"\"INSERT INTO user_history (user_id, content_type, content, description, questions, answers, file_name, folder_name) 
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id\"\"\", 
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
    # Moved OUTSIDE the open DB transaction to prevent holding the connection!
    try:
        client_q = get_q_client()
        if client_q and content:
            import uuid
            chunks = chunk_text(content, chunk_size=1500, overlap=300)
            if chunks:
                 emb_model = get_embedder()
                 embeddings = emb_model.encode(chunks, convert_to_numpy=True)
                 points = []
                 for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                     points.append(
                         PointStruct(
                             id=str(uuid.uuid4()),
                             vector=emb.tolist(),
                             payload={
                                 "history_id": entry_id, 
                                 "text": chunk, 
                                 "chunk_index": i,
                                 "file_name": file_name
                             }
                         )
                     )
                 client_q.upsert(collection_name="omnidoc_chunks", points=points)
    except Exception as q_err:
        print(f"Warning: Qdrant embedding failed ({q_err})")"""

    code = code.replace(standard_insert_original, standard_insert_fixed)

    # Chat connection fix
    chat_original = """        try:
            conn = get_db_connection()
            c = conn.cursor(cursor_factory=RealDictCursor)
            c.execute("UPDATE user_history SET answers = %s WHERE id = %s", (json.dumps(chat_history), history_id))
            conn.commit()
            release_db_connection(conn)
        except Exception:
            pass"""
            
    chat_fixed = """        try:
            conn_chat = get_db_connection()
            try:
                c_chat = conn_chat.cursor(cursor_factory=RealDictCursor)
                c_chat.execute("UPDATE user_history SET answers = %s WHERE id = %s", (json.dumps(chat_history), history_id))
                conn_chat.commit()
            finally:
                release_db_connection(conn_chat)
        except Exception:
            pass"""
            
    code = code.replace(chat_original, chat_fixed)

    with open('api.py', 'w', encoding='utf-8') as f:
        f.write(code)
        
    print("Fixes applied.")

if __name__ == '__main__':
    fix()
