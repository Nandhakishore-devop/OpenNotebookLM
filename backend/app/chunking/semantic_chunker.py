import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

try:
    import tiktoken
except ImportError:
    tiktoken = None


def clean_text(text: str) -> str:
    """
    Cleans text by normalizing whitespace, unicode, html remnants,
    and duplicate linebreaks or spaces.
    """
    if not text:
        return ""

    # 1. Normalize unicode spaces and quotes
    text = text.replace("\xa0", " ")
    text = text.replace("\u200b", "")

    # 2. Remove basic HTML remnants if any
    text = re.sub(r'<[^>]+>', '', text)

    # 3. Fix broken hyphenations (e.g. de- \n velopment -> development)
    text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)

    # 4. Standardize multiple newlines to max two (paragraphs)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # 5. Standardize spaces
    text = re.sub(r'[ \t]+', ' ', text)

    return text.strip()


def count_tokens(text: str, model_name: str = "cl100k_base") -> int:
    """
    Counts the number of tokens in a string using tiktoken.
    Falls back to a word-count heuristic if tiktoken is not available.
    """
    if tiktoken:
        try:
            encoding = tiktoken.get_encoding(model_name)
            return len(encoding.encode(text))
        except Exception as e:
            logger.warning(f"Error encoding with tiktoken: {e}. Using fallback.")
            
    # Fallback word-count approximation: ~1.3 tokens per word
    words = text.split()
    return int(len(words) * 1.3)


def split_into_sentences(text: str) -> List[str]:
    """
    Splits text into individual sentences using a robust regex pattern
    that ignores common abbreviations like Dr., Mr., e.g., i.e.
    """
    # Regex matching sentence boundaries:
    # A punctuation (. ! ?) followed by whitespace and a capital letter,
    # avoiding splitting common abbreviations.
    sentence_endings = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\!)\s')
    
    sentences = sentence_endings.split(text)
    return [s.strip() for s in sentences if s.strip()]


def create_semantic_chunks(
    text: str, 
    chunk_size_range: tuple = (400, 600), 
    overlap_range: tuple = (50, 100)
) -> List[Dict[str, Any]]:
    """
    Groups sentences into chunks based on token counts.
    Ensures that chunks never split mid-sentence.
    Implements a sliding window overlap of sentences from the previous chunk.
    """
    cleaned = clean_text(text)
    if not cleaned:
        return []

    sentences = split_into_sentences(cleaned)
    if not sentences:
        return []

    chunks = []
    current_sentences = []
    current_tokens = 0
    
    target_size = chunk_size_range[1]  # 600 tokens max
    min_size = chunk_size_range[0]     # 400 tokens min
    target_overlap = overlap_range[1]  # 100 tokens overlap

    for sentence in sentences:
        sentence_tokens = count_tokens(sentence)
        
        # If a single sentence exceeds the target size, we must yield it alone
        if sentence_tokens >= target_size:
            if current_sentences:
                # Yield current chunk first
                chunk_text = " ".join(current_sentences)
                chunks.append({
                    "text": chunk_text,
                    "token_count": current_tokens
                })
                current_sentences = []
                current_tokens = 0
            
            chunks.append({
                "text": sentence,
                "token_count": sentence_tokens
            })
            continue

        # If adding the next sentence exceeds the max limit
        if current_tokens + sentence_tokens > target_size:
            # Yield current chunk if it meets minimum requirements or is all we have
            chunk_text = " ".join(current_sentences)
            chunks.append({
                "text": chunk_text,
                "token_count": current_tokens
            })

            # Calculate overlap sentences: backtrack from the end of current_sentences
            overlap_sentences = []
            overlap_tokens = 0
            for prev_sentence in reversed(current_sentences):
                prev_tokens = count_tokens(prev_sentence)
                if overlap_tokens + prev_tokens <= target_overlap:
                    overlap_sentences.insert(0, prev_sentence)
                    overlap_tokens += prev_tokens
                else:
                    break

            # Initialize next chunk with overlap
            current_sentences = overlap_sentences + [sentence]
            current_tokens = overlap_tokens + sentence_tokens
        else:
            current_sentences.append(sentence)
            current_tokens += sentence_tokens

    # Append any remaining content
    if current_sentences:
        chunk_text = " ".join(current_sentences)
        chunks.append({
            "text": chunk_text,
            "token_count": current_tokens
        })

    # Add indices to the chunks
    for i, chunk in enumerate(chunks):
        chunk["chunk_index"] = i

    return chunks
