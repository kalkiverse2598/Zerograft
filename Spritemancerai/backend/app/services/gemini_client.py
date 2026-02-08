"""
Gemini API Client for SpriteMancer AI.

Handles all interactions with Google's Gemini models for:
- Text generation (gemini-3-pro-preview)
- Image generation (gemini-3-pro-image-preview)

Includes automatic retry with exponential backoff for transient errors.
"""
import asyncio
import json
from typing import Optional
from google import genai
from google.genai import types
from google.genai.errors import ServerError, ClientError

from app.config import get_settings


class GeminiError(Exception):
    """Custom exception for Gemini API errors."""
    def __init__(self, message: str, retryable: bool = False, original_error: Exception = None):
        super().__init__(message)
        self.retryable = retryable
        self.original_error = original_error


class GeminiClient:
    """Client for Gemini API interactions with automatic retry."""
    
    # Retry configuration
    MAX_RETRIES = 3
    INITIAL_BACKOFF = 1.0  # seconds
    MAX_BACKOFF = 16.0  # seconds
    BACKOFF_MULTIPLIER = 2.0
    
    # Retryable HTTP status codes
    RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
    
    def __init__(self):
        self.settings = get_settings()
        self.client = genai.Client(api_key=self.settings.gemini_api_key)
        self._system_instruction: Optional[str] = None
        self._stage_instructions: dict[str, str] = {}  # Cache for stage-specific instructions
    
    @property
    def system_instruction(self) -> str:
        """Load and cache default system instruction."""
        if self._system_instruction is None:
            import os
            prompt_path = os.path.join(
                os.path.dirname(__file__), 
                "..", "prompts", "system_instruction.json"
            )
            try:
                with open(prompt_path) as f:
                    self._system_instruction = json.dumps(json.load(f))
            except FileNotFoundError:
                print(f"⚠️ System instruction not found at {prompt_path}, using default")
                self._system_instruction = "{}"
        return self._system_instruction
    
    def get_system_instruction(self, stage: Optional[str] = None) -> str:
        """
        Get system instruction for a specific stage.
        
        Args:
            stage: Stage identifier (e.g., "1_dna", "3a_action", "5_script")
                   If None, returns the default full system instruction.
        
        Returns:
            JSON string of the system instruction
        """
        if stage is None:
            return self.system_instruction
        
        # Check cache first
        if stage in self._stage_instructions:
            return self._stage_instructions[stage]
        
        # Try to load stage-specific instruction
        import os
        stage_path = os.path.join(
            os.path.dirname(__file__),
            "..", "prompts", f"system_stage_{stage}.json"
        )
        
        try:
            with open(stage_path) as f:
                instruction = json.dumps(json.load(f))
                self._stage_instructions[stage] = instruction
                print(f"📋 Loaded stage-specific instruction: system_stage_{stage}.json")
                return instruction
        except FileNotFoundError:
            print(f"⚠️ Stage instruction not found: {stage_path}, using default")
            return self.system_instruction
    
    async def _retry_with_backoff(self, func, operation_name: str):
        """
        Retry an async function with exponential backoff.
        
        Args:
            func: Async function to call
            operation_name: Name for logging
        
        Returns:
            Result from the function
        
        Raises:
            GeminiError: If all retries fail
        """
        last_error = None
        backoff = self.INITIAL_BACKOFF
        
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                return await func()
            except ServerError as e:
                last_error = e
                error_code = getattr(e, 'status_code', 500)
                
                if error_code not in self.RETRYABLE_STATUS_CODES:
                    raise GeminiError(
                        f"Gemini API error: {str(e)}", 
                        retryable=False, 
                        original_error=e
                    )
                
                if attempt < self.MAX_RETRIES:
                    print(f"⚠️ {operation_name} failed (attempt {attempt}/{self.MAX_RETRIES}): {e}")
                    print(f"   Retrying in {backoff:.1f}s...")
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * self.BACKOFF_MULTIPLIER, self.MAX_BACKOFF)
                else:
                    print(f"❌ {operation_name} failed after {self.MAX_RETRIES} attempts")
            except ClientError as e:
                # Client errors (4xx except 429) are not retryable
                raise GeminiError(
                    f"Gemini API client error: {str(e)}", 
                    retryable=False, 
                    original_error=e
                )
            except Exception as e:
                # Unknown errors - log and raise
                raise GeminiError(
                    f"Unexpected error during {operation_name}: {str(e)}", 
                    retryable=False, 
                    original_error=e
                )
        
        # All retries exhausted
        raise GeminiError(
            f"Gemini API overloaded. Please try again in a few seconds.",
            retryable=True,
            original_error=last_error
        )
    
    async def generate_text(
        self,
        prompt: str,
        thinking_level: str = "low",
        temperature: float = 0.3,
        response_schema: Optional[dict] = None,
        stage: Optional[str] = None,
    ) -> dict:
        """
        Generate text using gemini-3-pro-preview with automatic retry.
        
        Args:
            prompt: The prompt to send
            thinking_level: "low" (1024 tokens) or "high" (8192 tokens)
            temperature: Sampling temperature
            response_schema: Optional JSON schema for response
            stage: Stage identifier for stage-specific system instruction
        """
        print(f"✨ Gemini Request (Text): {prompt[:50]}...")
        
        config = types.GenerateContentConfig(
            system_instruction=self.get_system_instruction(stage),
            temperature=temperature,
            response_mime_type="application/json",
            thinking_config=types.ThinkingConfig(
                thinking_budget=1024 if thinking_level == "low" else 8192
            ),
        )
        
        if response_schema:
            config.response_schema = response_schema
        
        async def _call():
            response = await self.client.aio.models.generate_content(
                model=self.settings.gemini_text_model,
                contents=prompt,
                config=config,
            )
            return response
        
        response = await self._retry_with_backoff(_call, "Text generation")
        print("✅ Gemini Response received")
        
        # Extract text from response, handling various response formats
        text = self._extract_text_from_response(response)
        return self._parse_json_response(text)
    
    def _extract_text_from_response(self, response) -> str:
        """Extract text content from Gemini response, handling edge cases."""
        # Try response.text first
        if response.text:
            return response.text
        
        # If text is None, try to extract from parts
        if response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'text') and part.text:
                            return part.text
        
        # Check if there's thinking content but no response
        print("⚠️ Gemini returned empty response, attempting to extract from raw response...")
        
        # Last resort: convert response to string and look for JSON
        response_str = str(response)
        if '{' in response_str:
            start = response_str.find('{')
            return response_str[start:]
        
        raise GeminiError(
            "Gemini returned an empty response. Please try again.",
            retryable=True
        )
    
    def _parse_json_response(self, text: str) -> dict:
        """Parse JSON response, handling extra data after valid JSON."""
        # Handle None or empty text
        if not text:
            raise GeminiError("Empty response from Gemini", retryable=True)
        
        # First try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            # Try to extract just the JSON object
            if "Extra data" in str(e):
                # Find the end of the first JSON object
                depth = 0
                in_string = False
                escape = False
                for i, char in enumerate(text):
                    if escape:
                        escape = False
                        continue
                    if char == '\\':
                        escape = True
                        continue
                    if char == '"' and not escape:
                        in_string = not in_string
                        continue
                    if in_string:
                        continue
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            # Found the end of the first JSON object
                            return json.loads(text[:i+1])
            
            # Try to find JSON between code blocks
            import re
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
            if json_match:
                return json.loads(json_match.group(1))
            
            # Try to find JSON by finding { and matching }
            start = text.find('{')
            if start != -1:
                bracket_count = 0
                for i in range(start, len(text)):
                    if text[i] == '{':
                        bracket_count += 1
                    elif text[i] == '}':
                        bracket_count -= 1
                        if bracket_count == 0:
                            return json.loads(text[start:i+1])
            
            # Re-raise original error
            raise
    
    async def generate_text_with_image(
        self,
        prompt: str,
        image_bytes: bytes,
        thinking_level: str = "high",
        temperature: float = 0.3,
        response_schema: Optional[dict] = None,
        stage: Optional[str] = None,
        model_override: Optional[str] = None,
    ) -> dict:
        """
        Generate text with image input with automatic retry.
        
        Args:
            prompt: The prompt to send
            image_bytes: Image data
            thinking_level: "low" (1024 tokens) or "high" (8192 tokens)
            temperature: Sampling temperature
            response_schema: Optional JSON schema for response
            stage: Stage identifier for stage-specific system instruction
            model_override: Override the default model (e.g., "gemini-2.0-flash")
        """
        model = model_override or self.settings.gemini_text_model
        print(f"✨ Gemini Request (Vision, {model}): {prompt[:50]}... with {len(image_bytes)} bytes image")
        
        config = types.GenerateContentConfig(
            system_instruction=self.get_system_instruction(stage),
            temperature=temperature,
            response_mime_type="application/json",
            thinking_config=types.ThinkingConfig(
                thinking_budget=1024 if thinking_level == "low" else 8192
            ),
        )
        
        if response_schema:
            config.response_schema = response_schema
        
        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
        
        async def _call():
            response = await self.client.aio.models.generate_content(
                model=model,
                contents=[image_part, prompt],
                config=config,
            )
            return response
        
        response = await self._retry_with_backoff(_call, "Vision analysis")
        print("✅ Gemini Vision Response received")
        
        # Use the same text extraction helper as generate_text to handle edge cases
        text = self._extract_text_from_response(response)
        return self._parse_json_response(text)
    
    async def generate_image(
        self,
        prompt: str,
        reference_images: Optional[list[bytes]] = None,
        aspect_ratio: str = "1:1",
    ) -> bytes:
        """
        Generate an image with automatic retry.
        """
        print(f"🎨 Gemini Request (Image Gen): {prompt[:50]}...")
        contents = []
        
        # Add reference images for character consistency
        if reference_images:
            for img_bytes in reference_images[:14]:  # Max 14 references
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type="image/png"))
        
        contents.append(prompt)
        
        async def _call():
            response = await self.client.aio.models.generate_content(
                model=self.settings.gemini_image_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                ),
            )
            return response
        
        response = await self._retry_with_backoff(_call, "Image generation")
        print("✅ Gemini Image generated")
        
        # Extract image from response
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                return part.inline_data.data
        
        raise GeminiError("No image generated in response", retryable=False)
    
    async def edit_image_simple(
        self,
        image_bytes: bytes,
        edit_prompt: str,
    ) -> bytes:
        """
        Edit an image using a text prompt (no mask required).
        
        Perfect for simple edits like changing background color while
        keeping the subject exactly the same.
        
        Args:
            image_bytes: The image to edit
            edit_prompt: Description of the edit (e.g., "change background to black")
        
        Returns:
            Edited image bytes
        """
        print(f"🎨 Gemini Request (Simple Edit): {edit_prompt[:50]}...")
        
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
            edit_prompt,
        ]
        
        async def _call():
            response = await self.client.aio.models.generate_content(
                model=self.settings.gemini_image_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                ),
            )
            return response
        
        response = await self._retry_with_backoff(_call, "Simple image edit")
        print("✅ Gemini Simple Edit completed")
        
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                return part.inline_data.data
        
        raise GeminiError("No image generated in edit response", retryable=False)
    
    async def edit_image(
        self,
        image_bytes: bytes,
        mask_bytes: bytes,
        edit_prompt: str,
        reference_image: Optional[bytes] = None,
        context_images: Optional[list[bytes]] = None,
    ) -> bytes:
        """
        Edit an image using mask-based inpainting with automatic retry.
        
        Args:
            image_bytes: The image to edit
            mask_bytes: Mask indicating area to edit (white = edit area)
            edit_prompt: Description of the edit
            reference_image: Original reference for style consistency
            context_images: Previous frames for animation continuity
        """
        print(f"🎨 Gemini Request (Edit): {edit_prompt[:50]}...")
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
            types.Part.from_bytes(data=mask_bytes, mime_type="image/png"),
        ]
        
        if reference_image:
            contents.append(types.Part.from_bytes(data=reference_image, mime_type="image/png"))
        
        # Add context images (previous frames) for animation continuity
        if context_images:
            for i, ctx_img in enumerate(context_images[:2]):  # Max 2 context frames
                contents.append(types.Part.from_bytes(data=ctx_img, mime_type="image/png"))
            print(f"  ↳ Added {len(context_images[:2])} context frames for animation continuity")
        
        contents.append(edit_prompt)
        
        async def _call():
            response = await self.client.aio.models.generate_content(
                model=self.settings.gemini_image_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                ),
            )
            return response
        
        response = await self._retry_with_backoff(_call, "Image editing")
        print("✅ Gemini Edit completed")
        
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                return part.inline_data.data
        
        raise GeminiError("No image generated in edit response", retryable=False)


# Singleton instance
gemini_client = GeminiClient()
