FROM node:20-alpine

# Install curl for healthcheck (node:alpine has neither wget nor curl)
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

# Expose API port (8080) - MCP traffic is proxied via path /servers/:name/mcp
EXPOSE 8080

ENV PORT=8080
ENV HOST=0.0.0.0

CMD ["node", "src/index.js"]
