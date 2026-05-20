import logging
from typing import Dict, Any, List, Tuple
import urllib.request
import urllib.parse
import httpx

logger = logging.getLogger(__name__)

try:
    import trafilatura
except ImportError:
    trafilatura = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


async def extract_web_content(url: str) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Scrapes a website URL, removing boilerplate (nav, ads, sidebars) and extracting clean article text.
    """
    global_meta = {"source_url": url}
    html_content = ""

    # 1. Fetch page using httpx
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = await client.get(url, headers=headers)
            html_content = response.text
            global_meta["status_code"] = response.status_code
    except Exception as e:
        logger.error(f"Failed to fetch URL {url}: {e}")
        return f"Error: Could not retrieve webpage at {url}. Detail: {str(e)}", [], global_meta

    if not html_content:
        return "Error: Empty response from webpage.", [], global_meta

    # 2. Try trafilatura first for high-quality boilerplate removal
    if trafilatura:
        try:
            # extract returns main text content
            clean_text = trafilatura.extract(html_content, include_comments=False, include_tables=True, no_fallback=False)
            metadata = trafilatura.extract_metadata(html_content)
            
            if metadata:
                global_meta.update({
                    "title": metadata.title,
                    "author": metadata.author,
                    "date": metadata.date,
                    "description": metadata.description
                })

            if clean_text:
                logger.info(f"Trafilatura successfully extracted text from {url}")
                return clean_text, [], global_meta
        except Exception as e:
            logger.warning(f"Trafilatura parsing failed: {e}. Falling back to BeautifulSoup.")

    # 3. Fallback to BeautifulSoup
    if BeautifulSoup:
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            
            # Remove scripts, styles, footer, navigation, ads, sidebars
            for element in soup(["script", "style", "nav", "footer", "aside", "header", "iframe", "noscript"]):
                element.decompose()

            # Try to get title
            title_tag = soup.find("title")
            if title_tag:
                global_meta["title"] = title_tag.get_text().strip()

            # Extract main content blocks
            body_text_blocks = []
            
            # Try to find article or main content div first
            main_content = soup.find("article") or soup.find("main") or soup.find(id="content") or soup.find(class_="content")
            target = main_content if main_content else soup.body
            
            if target:
                for p in target.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
                    text = p.get_text().strip()
                    if text:
                        if p.name.startswith("h"):
                            body_text_blocks.append(f"\n# {text}\n")
                        else:
                            body_text_blocks.append(text)
            
            clean_text = "\n\n".join(body_text_blocks)
            if clean_text.strip():
                return clean_text, [], global_meta
        except Exception as e:
            logger.error(f"BeautifulSoup parsing failed: {e}")

    # Ultimate fallback: return raw HTML stripped of tags
    if BeautifulSoup:
        try:
            return BeautifulSoup(html_content, "html.parser").get_text(), [], global_meta
        except:
            pass

    return html_content, [], global_meta
