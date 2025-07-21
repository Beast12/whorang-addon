# Multi-stage build for backend with integrated nginx
FROM node:22-alpine AS builder

# Build arguments
ARG BUILD_VERSION=1.1.2

WORKDIR /app

# Install build dependencies for native modules and canvas dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Production stage with nginx
FROM node:22-alpine

# Build arguments
ARG BUILD_VERSION=1.1.2

WORKDIR /app

# Install nginx, sqlite, curl, and other runtime dependencies including canvas runtime deps
RUN apk add --no-cache \
    nginx \
    sqlite \
    curl \
    su-exec \
    gettext \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

# Copy package files
COPY package*.json ./

# Copy built node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY . .

# Copy Home Assistant integration files to the proper location
COPY custom_components /config/custom_components

# Copy nginx configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY backend.conf /etc/nginx/conf.d/default.conf

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create /data directory structure for Home Assistant addon
RUN mkdir -p /data/uploads/faces /data/uploads/temp /data/uploads/thumbnails

# Set ownership of the app directory (except volumes which will be handled by entrypoint)
RUN chown -R node:node /app

# Try to set ownership of /data directory (may fail in some HA configurations, that's OK)
RUN chown -R node:node /data 2>/dev/null || echo "Warning: Could not set ownership of /data directory"

# Add Home Assistant add-on labels
LABEL \
    io.hass.version="${BUILD_VERSION}" \
    io.hass.type="addon" \
    io.hass.arch="armhf|armv7|aarch64|amd64|i386"

# Expose port 80 (nginx will serve on port 80)
EXPOSE 80

# Use entrypoint to ensure everything starts properly
ENTRYPOINT ["/entrypoint.sh"]
