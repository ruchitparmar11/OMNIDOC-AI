import pdfplumber
import pytesseract
import os

def extract_text_from_pdf(file_path):
    text = ""
    
    # Method 1: Try standard extraction with pdfplumber
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        print(f"Error during standard PDF extraction: {e}")

    text = text.strip()

    # Method 2: If text is empty or very short, try OCR (Scanned PDF)
    if len(text) < 50:
        print("Text too short or empty, attempting OCR...")
        try:
            from pdf2image import convert_from_path
        except ImportError:
             return (f"{text}\n\n[WARNING]: This looks like a scanned PDF, but the 'pdf2image' module is not installed.\n"
                     "Please install it using 'pip install pdf2image' and ensure Poppler is installed to enable OCR.")

        try:
            # Convert PDF to images
            # Note: This requires poppler to be installed and in PATH
            images = convert_from_path(file_path)
            
            ocr_text = ""
            for i, image in enumerate(images):
                # Use pytesseract to extract text from each image
                page_text = pytesseract.image_to_string(image)
                ocr_text += f"--- Page {i+1} ---\n{page_text}\n"
            
            if ocr_text.strip():
                return ocr_text.strip()
                
        except Exception as e:
            # Fallback if text was extracted but OCR failed (e.g. no poppler)
            if text:
                return text
            
            error_msg = str(e)
            if "poppler" in error_msg.lower():
                return "Error: Scanned PDF detected but 'poppler' is not installed or not in PATH. Please install poppler to enable OCR for PDFs."
            return f"Error processing PDF: {error_msg}"

    return text 