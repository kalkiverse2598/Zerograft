# AI Router Deployment

This directory contains the deployment configuration for the AI Router.

## Files to Copy

Before building, copy these files from the source:

```bash
# From the source directory (src/zerograft-ai/src/mcp-servers/godot/):
cp -r dist/ deploy/ai-router/
cp package.json deploy/ai-router/
cp package-lock.json deploy/ai-router/
```

## Build & Run

```bash
cd deploy
docker compose build ai-router
docker compose up -d ai-router
```

## Environment Variables

- `GEMINI_API_KEY` - API key (or "proxy-managed" if using proxy)
- `GEMINI_PROXY_URL` - Optional proxy URL (e.g., http://gemini-proxy:8001)
- `GEMINI_MODEL` - Model to use (default: gemini-3-flash-preview)
- `AI_ROUTER_PORT` - HTTP API port (default: 9877)
- `AI_ROUTER_WS_PORT` - WebSocket port (default: 9878)
- `GODOT_BRIDGE_HOST` - Host to bind (default: 0.0.0.0)
- `GODOT_BRIDGE_PORT` - Godot TCP bridge port (default: 9876)

## Health Check

```bash
curl http://localhost:9877/health
```
