import os
import io
import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None
    Image = None


def extract_pdf_content(file_bytes: bytes, filename: str) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Parses a PDF using PyMuPDF and pdfplumber.
    Returns:
        - full text (str)
        - pages metadata list (List[Dict])
        - global document metadata (Dict)
    """
    full_text_list = []
    pages_meta = []
    global_meta = {"filename": filename}

    # 1. Try PyMuPDF for quick extraction and global metadata
    if fitz:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            global_meta.update(doc.metadata or {})
            logger.info(f"PyMuPDF opened {filename} with {len(doc)} pages.")
            doc.close()
        except Exception as e:
            logger.warning(f"PyMuPDF metadata extraction failed: {e}")

    # 2. Extract page-by-page text & tables using pdfplumber (retains tables better)
    if pdfplumber:
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_num = i + 1
                    page_text = page.extract_text() or ""
                    
                    # Extract tables
                    tables_text = ""
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            # Convert table rows to markdown representation
                            rows_str = []
                            for row in table:
                                if row:
                                    rows_str.append(" | ".join([str(cell or "").replace("\n", " ") for cell in row]))
                            if rows_str:
                                tables_text += "\n\n[Table Extraction]\n" + "\n".join(rows_str) + "\n"

                    # If page text is very short/empty, check if OCR is needed
                    if len(page_text.strip()) < 50 and pytesseract:
                        try:
                            # Convert PDF page to PIL Image for OCR
                            # Note: pdfplumber allows page.to_image().original
                            pil_img = page.to_image(resolution=150).original
                            ocr_text = pytesseract.image_to_string(pil_img)
                            if ocr_text.strip():
                                page_text += "\n\n[OCR Text]\n" + ocr_text
                        except Exception as ocr_err:
                            logger.warning(f"OCR failed for page {page_num} in {filename}: {ocr_err}")

                    combined_text = page_text + tables_text
                    full_text_list.append(combined_text)
                    pages_meta.append({
                        "page_number": page_num,
                        "char_count": len(combined_text)
                    })
        except Exception as e:
            logger.error(f"pdfplumber extraction failed: {e}. Falling back to PyMuPDF.")
            
    # Fallback to PyMuPDF if pdfplumber failed or is not available
    if not full_text_list and fitz:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for i, page in enumerate(doc):
                page_num = i + 1
                page_text = page.get_text() or ""
                
                # Basic OCR fallback using pytesseract if PyMuPDF returns empty text
                if len(page_text.strip()) < 50 and pytesseract:
                    try:
                        pix = page.get_pixmap(dpi=150)
                        img_data = pix.tobytes("png")
                        pil_img = Image.open(io.BytesIO(img_data))
                        ocr_text = pytesseract.image_to_string(pil_img)
                        if ocr_text.strip():
                            page_text += "\n\n[OCR Text]\n" + ocr_text
                    except Exception as ocr_err:
                        logger.warning(f"PyMuPDF page {page_num} OCR failed: {ocr_err}")

                full_text_list.append(page_text)
                pages_meta.append({
                    "page_number": page_num,
                    "char_count": len(page_text)
                })
            doc.close()
        except Exception as e:
            logger.error(f"PyMuPDF fallback failed: {e}")

    full_text = "\n\n--- PAGE BREAK ---\n\n".join(full_text_list)
    return full_text, pages_meta, global_meta
