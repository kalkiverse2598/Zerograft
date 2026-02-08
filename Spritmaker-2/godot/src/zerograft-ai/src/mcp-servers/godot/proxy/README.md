# Gemini API Proxy

A simple proxy server that allows judges to use your Gemini API key without exposing it.

## Features

- ✅ Rate limiting (100 requests/hour per IP, 500/day total)
- ✅ Streaming support for token-by-token responses
- ✅ Health check endpoint
- ✅ Usage statistics

## Deployment on KVM

```bash
# 1. Install dependencies
cd proxy
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Run
python gemini_proxy.py
# Or with uvicorn for production:
uvicorn gemini_proxy:app --host 0.0.0.0 --port 8001
```

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Check if proxy is running |
| `GET /stats` | View usage statistics |
| `POST /v1beta/*` | Proxy to Gemini API |

## Rate Limits

| Limit | Value |
|-------|-------|
| Per IP per hour | 100 requests |
| Total per day | 500 requests |

Adjust in `.env` if needed.

## Integration

Update the MCP server to use the proxy:

```typescript
// In geminiLLMv2.ts, change:
const GEMINI_BASE_URL = process.env.GEMINI_PROXY_URL || "https://generativelanguage.googleapis.com";
```

When `GEMINI_PROXY_URL` is set (e.g., `https://your-kvm-server.com:8001`), requests go through your proxy.
