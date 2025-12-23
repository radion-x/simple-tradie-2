# Production-ready Dockerfile for Coolify / container platforms
# Image: small, secure Node runtime
FROM node:20-alpine

# Create and set working directory
WORKDIR /app

# Environment defaults (Coolify dashboard will override)
ENV NODE_ENV=production \
    PORT=3000

# Install only production dependencies using cached layers
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Optional: ensure correct ownership and drop root
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

# Expose the app port (Coolify expects this)
EXPOSE 3000

# Health check - ensures container is marked healthy when app is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "server.js"]
