# Build Stage
FROM node:20 AS builder

WORKDIR /app

# Install dependencies for both client and server
COPY server/package*.json ./server/
RUN cd server && npm install

COPY client/package*.json ./client/
RUN cd client && npm install

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Final Stage
FROM node:20-slim

# Install system dependencies for sqlite3 and native builds
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN mkdir -p /app/data /app/recordings

# Install production dependencies for server
COPY server/package*.json ./
RUN npm install --production

# Copy built frontend from builder stage
COPY --from=builder /app/client/dist ./public
# Copy server source
COPY server/ .

ENV NODE_ENV=production
ENV PORT=3020
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

EXPOSE 3020

CMD ["node", "index.js"]
