"""
Gemini API Proxy Server for Agentic Godot
==========================================

A simple FastAPI proxy that:
1. Provides your Gemini API key to judges without exposing it
2. Implements rate limiting to prevent abuse
3. Logs usage for monitoring

Deploy this on your KVM server alongside SpriteMancer.
"""

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
import os
import time
from collections import defaultdict
from typing import Optional
import json

app = FastAPI(
    title="Agentic Godot Gemini Proxy",
    description="Proxies Gemini API requests for hackathon judges"
)

# CORS for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com"

# Rate limiting configuration (read from env for Docker override)
RATE_LIMIT_REQUESTS = int(os.environ.get("RATE_LIMIT_REQUESTS", "1000"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "3600"))
DAILY_LIMIT = int(os.environ.get("DAILY_LIMIT", "5000"))

# In-memory rate limiting (use Redis for production)
request_counts = defaultdict(list)  # IP -> [timestamps]
daily_count = 0
daily_reset_time = time.time()


def get_client_ip(request: Request) -> str:
    """Get client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host


def check_rate_limit(ip: str) -> bool:
    """Check if IP is within rate limit."""
    global daily_count, daily_reset_time
    
    now = time.time()
    
    # Reset daily counter
    if now - daily_reset_time > 86400:  # 24 hours
        daily_count = 0
        daily_reset_time = now
    
    # Check daily limit
    if daily_count >= DAILY_LIMIT:
        return False
    
    # Clean old timestamps for this IP
    request_counts[ip] = [
        ts for ts in request_counts[ip] 
        if now - ts < RATE_LIMIT_WINDOW_SECONDS
    ]
    
    # Check per-IP limit
    if len(request_counts[ip]) >= RATE_LIMIT_REQUESTS:
        return False
    
    # Record this request
    request_counts[ip].append(now)
    daily_count += 1
    
    return True


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "gemini-proxy",
        "daily_requests_remaining": DAILY_LIMIT - daily_count,
        "api_key_configured": bool(GEMINI_API_KEY)
    }


@app.api_route("/v1beta/{path:path}", methods=["GET", "POST"])
async def proxy_gemini(path: str, request: Request):
    """
    Proxy all Gemini API requests.
    
    Usage from MCP server:
    - Change base URL from googleapis.com to your-proxy.com
    - No API key needed in client
    """
    client_ip = get_client_ip(request)
    
    # Check rate limit
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "message": "Please use your own API key. Get one free at https://aistudio.google.com/apikey",
                "fallback": True
            }
        )
    
    # Check API key is configured
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Proxy not configured",
                "message": "Please use your own API key",
                "fallback": True
            }
        )
    
    # Build target URL
    target_url = f"{GEMINI_BASE_URL}/v1beta/{path}"
    
    # Get query params and add API key
    params = dict(request.query_params)
    params["key"] = GEMINI_API_KEY
    
    # Get request body
    body = await request.body()
    
    # Check if this is a streaming request
    is_streaming = "streamGenerateContent" in path
    
    if is_streaming:
        # Streaming: create a dedicated client that lives for the duration of the stream
        async def stream_response():
            client = httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0))
            try:
                async with client.stream(
                    method=request.method,
                    url=target_url,
                    params=params,
                    content=body,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    async for chunk in response.aiter_bytes():
                        yield chunk
            finally:
                await client.aclose()
        
        return StreamingResponse(
            stream_response(),
            media_type="text/event-stream",
            headers={
                "X-Proxy-By": "agentic-godot",
                "X-Requests-Remaining": str(DAILY_LIMIT - daily_count),
                "Cache-Control": "no-cache",
            }
        )
    else:
        # Non-streaming: use a short-lived client
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                params=params,
                content=body,
                headers={"Content-Type": "application/json"}
            )
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers={
                    "Content-Type": "application/json",
                    "X-Proxy-By": "agentic-godot",
                    "X-Requests-Remaining": str(DAILY_LIMIT - daily_count)
                }
            )


@app.get("/stats")
async def get_stats():
    """Get usage statistics (admin endpoint)."""
    return {
        "daily_requests": daily_count,
        "daily_limit": DAILY_LIMIT,
        "unique_ips": len(request_counts),
        "hourly_limit_per_ip": RATE_LIMIT_REQUESTS
    }


# Missing import
from fastapi.responses import Response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
