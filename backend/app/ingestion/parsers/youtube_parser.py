import re
import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    YouTubeTranscriptApi = None


def extract_youtube_video_id(url: str) -> str:
    """
    Extracts the video ID from a standard, short, or share YouTube link.
    """
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'youtu\.be\/([0-9A-Za-z_-]{11})',
        r'embed\/([0-9A-Za-z_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""


def extract_youtube_content(url: str) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Downloads the transcript and segment metadata of a YouTube video.
    """
    global_meta = {"source_url": url}
    video_id = extract_youtube_video_id(url)
    
    if not video_id:
        logger.error(f"Could not extract YouTube video ID from URL: {url}")
        return "Error: Invalid YouTube URL.", [], global_meta

    global_meta["video_id"] = video_id

    if not YouTubeTranscriptApi:
        logger.error("youtube-transcript-api is not installed.")
        return f"Error: YouTube parsing dependency missing. Video ID: {video_id}", [], global_meta

    try:
        # Fetch the transcript (defaults to English, fallback options can be configured)
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        
        full_text_parts = []
        segments_meta = []
        
        for idx, segment in enumerate(transcript_list):
            start = segment.get("start", 0.0)
            duration = segment.get("duration", 0.0)
            text = segment.get("text", "").strip()
            
            if not text:
                continue
                
            # Convert start time to HH:MM:SS format
            hours = int(start // 3600)
            minutes = int((start % 3600) // 60)
            seconds = int(start % 60)
            timestamp_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            full_text_parts.append(f"[{timestamp_str}] {text}")
            
            segments_meta.append({
                "segment_index": idx,
                "timestamp": timestamp_str,
                "start_seconds": start,
                "duration_seconds": duration,
                "text": text
            })
            
        full_text = "\n".join(full_text_parts)
        logger.info(f"Successfully retrieved YouTube transcript for video {video_id} with {len(transcript_list)} segments.")
        return full_text, segments_meta, global_meta

    except Exception as e:
        logger.error(f"Failed to fetch YouTube transcript for video {video_id}: {e}")
        return f"Error: Could not retrieve YouTube transcript for video {video_id}. Detail: {str(e)}", [], global_meta
