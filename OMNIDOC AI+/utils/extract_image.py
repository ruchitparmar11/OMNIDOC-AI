from PIL import Image
import pytesseract

def extract_text_from_image(file_path):
    try:
        image = Image.open(file_path)
        text = pytesseract.image_to_string(image).strip()
        
        if not text:
            return "No text could be extracted from this image. The image might not contain readable text or the text might be too small/blurry for OCR to detect."
        
        return text
    except Exception as e:
        return f"Error processing image: {str(e)}. The image might be corrupted or in an unsupported format." 