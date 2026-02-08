# AI Router Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy compiled code
COPY dist/ ./dist/

# Default ports (can override with env)
ENV AI_ROUTER_PORT=9877
ENV AI_ROUTER_WS_PORT=9878
ENV GODOT_BRIDGE_HOST=0.0.0.0
ENV GODOT_BRIDGE_PORT=9876

EXPOSE 9877 9878

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -q --spider http://localhost:${AI_ROUTER_PORT}/health || exit 1

CMD ["node", "dist/aiRouter.js"]
