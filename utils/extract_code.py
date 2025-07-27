def extract_text_from_code(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read().strip() 