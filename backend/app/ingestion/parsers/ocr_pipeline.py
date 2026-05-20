import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None
    Image = None


def run_ocr_on_image(image_bytes: bytes) -> str:
    """
    Runs OCR on raw image bytes using pytesseract.
    """
    if not pytesseract or not Image:
        logger.error("pytesseract or PIL is not installed.")
        return ""

    try:
        image = Image.open(io.BytesIO(image_bytes))
        ocr_text = pytesseract.image_to_string(image)
        logger.info("Successfully ran OCR on image.")
        return ocr_text.strip()
    except Exception as e:
        logger.error(f"OCR execution failed: {e}")
        return ""


def clean_and_merge_ocr(parsed_text: str, ocr_text: str) -> str:
    """
    Merges OCR-extracted text with parsed document content.
    """
    if not ocr_text.strip():
        return parsed_text
        
    if not parsed_text.strip():
        return ocr_text

    # Merge OCR content at the end of the text
    return f"{parsed_text}\n\n[OCR Supplemental Text]\n{ocr_text}"
