import json
import logging
from typing import List, Dict, Any, AsyncGenerator
import httpx
from groq import AsyncGroq
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMProvider:
    def __init__(self):
        self.groq_api_key = getattr(settings, "GROQ_API_KEY", "")
        self.ollama_base_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
        self.primary_model = "llama-3.1-8b-instant"
        self.fallback_model = "llama3"

    async def generate_stream(
        self, 
        system_prompt: str, 
        messages: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        """
        Streams response from primary LLM provider (Groq) with an automatic 
        fallback to the secondary provider (Ollama) upon any failure or rate limit.
        """
        success = False
        
        # 1. Attempt Groq call
        if self.groq_api_key:
            try:
                logger.info(f"Calling Groq primary model '{self.primary_model}'...")
                client = AsyncGroq(api_key=self.groq_api_key)
                
                # Format messages for Groq completion
                formatted_messages = [{"role": "system", "content": system_prompt}] + messages
                
                response = await client.chat.completions.create(
                    model=self.primary_model,
                    messages=formatted_messages,
                    stream=True,
                    temperature=0.2,
                )
                
                async for chunk in response:
                    token = chunk.choices[0].delta.content
                    if token:
                        yield token
                
                success = True
                logger.info("Successfully completed streaming from Groq.")
            except Exception as e:
                logger.warning(f"Groq API call failed: {e}. Initiating Ollama fallback workflow...")
        else:
            logger.warning("Groq API key not set. Skipping primary LLM and falling back to Ollama.")

        # 2. Fallback to Ollama if Groq failed
        if not success:
            async for token in self._generate_ollama_stream(system_prompt, messages):
                yield token

    async def _generate_ollama_stream(
        self, 
        system_prompt: str, 
        messages: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        """
        Invokes local Ollama server and streams responses token-by-token.
        """
        # Determine fallback model dynamically based on pulled local models
        local_model = await self._get_available_ollama_model()
        url = f"{self.ollama_base_url}/api/chat"
        formatted_messages = [{"role": "system", "content": system_prompt}] + messages
        
        payload = {
            "model": local_model,
            "messages": formatted_messages,
            "stream": True,
            "options": {
                "temperature": 0.2
            }
        }
        
        logger.info(f"Connecting to Ollama model '{local_model}' at {url}...")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        err_detail = ""
                        try:
                            body = await response.aread()
                            err_json = json.loads(body.decode("utf-8"))
                            if err_json.get("error"):
                                err_detail = f" - {err_json.get('error')}"
                        except:
                            pass
                        raise ValueError(f"Ollama server returned status code {response.status_code}{err_detail}")
                    
                    async for line in response.aiter_lines():
                        if line:
                            data = json.loads(line)
                            token = data.get("message", {}).get("content", "")
                            if token:
                                yield token
            logger.info("Successfully completed streaming from Ollama.")
        except Exception as e:
            logger.error(f"Ollama fallback failed: {e}")
            yield f"\n\n[System Note: Both Groq and Ollama endpoints are currently unreachable. Error: {e}]"

    async def _get_available_ollama_model(self) -> str:
        """
        Queries the local Ollama server to find pulled models.
        Filters out embedding models and returns the first available local LLM.
        """
        url = f"{self.ollama_base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    models = data.get("models", [])
                    
                    # Filter out embedding models (e.g. nomic-embed)
                    llm_models = []
                    for m in models:
                        name = m.get("name", "").lower()
                        if "embed" in name:
                            continue
                        llm_models.append(m.get("name"))
                    
                    if llm_models:
                        # Prefer Llama, Gemma or Phi models if available
                        for model in llm_models:
                            model_lower = model.lower()
                            if any(k in model_lower for k in ["llama", "gemma", "phi"]):
                                logger.info(f"Dynamically selected local Ollama LLM: '{model}'")
                                return model
                        
                        # Fallback to the first non-embedding model
                        logger.info(f"Dynamically selected first available Ollama model: '{llm_models[0]}'")
                        return llm_models[0]
        except Exception as e:
            logger.warning(f"Failed to query Ollama local tags list from {url}: {e}")
        
        return self.fallback_model

# Global provider instance
llm_provider = LLMProvider()
