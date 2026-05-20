import os
import tempfile
import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

try:
    import whisper
    import torch
except ImportError:
    whisper = None
    torch = None


def extract_audio_transcript(file_bytes: bytes, filename: str) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Transcribes audio using a local Whisper model.
    Saves file bytes temporarily, runs Whisper, and returns transcript text & timestamps.
    """
    global_meta = {"filename": filename}
    
    if not whisper:
        logger.error("Whisper or torch is not installed.")
        return "Error: Local audio transcription dependencies are missing.", [], global_meta

    # Create a temporary file to store audio bytes because Whisper expects a file path
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1] or ".mp3") as temp_file:
        temp_file.write(file_bytes)
        temp_file_path = temp_file.name

    try:
        # Check GPU availability and load Whisper model
        device = "cuda" if torch and torch.cuda.is_available() else "cpu"
        logger.info(f"Loading Whisper model ('base') on device: {device}")
        
        # Load 'base' model (good trade-off between speed and accuracy)
        model = whisper.load_model("base", device=device)
        
        logger.info(f"Transcribing {filename}...")
        result = model.transcribe(temp_file_path)
        
        full_text = result.get("text", "").strip()
        segments = result.get("segments", [])
        
        segments_meta = []
        full_text_timestamped = []

        for idx, seg in enumerate(segments):
            start = seg.get("start", 0.0)
            end = seg.get("end", 0.0)
            text = seg.get("text", "").strip()
            
            if not text:
                continue
                
            # Formatting timestamp
            hours = int(start // 3600)
            minutes = int((start % 3600) // 60)
            seconds = int(start % 60)
            timestamp_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            full_text_timestamped.append(f"[{timestamp_str}] {text}")
            
            segments_meta.append({
                "segment_index": idx,
                "timestamp": timestamp_str,
                "start_seconds": start,
                "end_seconds": end,
                "text": text
            })
            
        compiled_text = "\n".join(full_text_timestamped) if full_text_timestamped else full_text
        
        logger.info(f"Successfully transcribed audio {filename} using Whisper.")
        return compiled_text, segments_meta, global_meta

    except Exception as e:
        logger.error(f"Whisper transcription failed for {filename}: {e}")
        return f"Error: Local audio transcription failed. Detail: {str(e)}", [], global_meta

    finally:
        # Clean up temporary file
        try:
            os.remove(temp_file_path)
        except Exception as cleanup_err:
            logger.warning(f"Failed to remove temp audio file {temp_file_path}: {cleanup_err}")
