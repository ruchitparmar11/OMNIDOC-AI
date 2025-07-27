from docx import Document

def extract_text_from_word(file_path):
    doc = Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs]).strip() 