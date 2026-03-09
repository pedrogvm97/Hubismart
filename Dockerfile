# Build Stage
FROM node:20-slim AS builder

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

WORKDIR /app

# Install production dependencies for server
COPY server/package*.json ./
RUN npm install --production

# Install sqlite3 separately if needed for the platform
RUN npm install sqlite3

# Copy built frontend from builder stage
COPY --from=builder /app/client/dist ./public
# Copy server source
COPY server/ .

ENV NODE_ENV=production
ENV PORT=3020

EXPOSE 3020

CMD ["node", "index.js"]
