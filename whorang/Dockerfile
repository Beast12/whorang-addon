# Multi-stage build for backend with integrated nginx
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.20
FROM node:22-alpine AS builder

# Build arguments
ARG BUILD_VERSION=2.0.16
ARG BUILD_ARCH=amd64

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

# Production stage with Home Assistant base
FROM $BUILD_FROM

# Build arguments
ARG BUILD_VERSION
ARG BUILD_ARCH

WORKDIR /app

# Install Node.js, nginx, sqlite, curl, jq and other runtime dependencies
# Also install build dependencies to rebuild native modules for the target architecture
RUN apk add --no-cache \
    nodejs \
    npm \
    nginx \
    sqlite \
    curl \
    gettext \
    jq \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
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

# Create node user and group with standard IDs for better compatibility
RUN addgroup -S -g 1000 node && \
    adduser -S -u 1000 -G node -s /bin/sh -D node

# Create nginx group and user if they don't exist
RUN if ! getent group nginx >/dev/null 2>&1; then \
        addgroup -S nginx; \
    fi && \
    if ! getent passwd nginx >/dev/null 2>&1; then \
        adduser -S -G nginx -s /bin/sh -D nginx; \
    fi

# Copy package files
COPY package*.json ./

# Copy built node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Rebuild native modules for the target architecture
RUN npm rebuild better-sqlite3 canvas

# Copy source code
COPY . .

# Copy public directory
COPY public /app/public

# Copy nginx configuration files
RUN rm -f /etc/nginx/conf.d/*.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY backend.conf /etc/nginx/conf.d/default.conf

# Ensure icon and logo are in the correct location for Home Assistant
COPY icon.png ./icon.png
COPY logo.png ./logo.png

# Copy and set up scripts
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY run.sh /run.sh
RUN chmod +x /docker-entrypoint.sh /run.sh

# Create nginx directory structure with proper temp directories
RUN mkdir -p /tmp/nginx-client-body \
    /tmp/nginx-proxy \
    /tmp/nginx-fastcgi \
    /tmp/nginx-uwsgi \
    /tmp/nginx-scgi \
    /var/lib/nginx \
    /var/cache/nginx \
    /run/nginx

# Create /data directory structure for Home Assistant addon
RUN mkdir -p /data/uploads/faces /data/uploads/temp /data/uploads/thumbnails

# Create application fallback directories
RUN mkdir -p /app/uploads/faces /app/uploads/temp /app/uploads/thumbnails /app/data

# Create custom OpenSSL config for Node.js
RUN mkdir -p /app/ssl && \
    echo "# Minimal OpenSSL config for Home Assistant add-on" > /app/ssl/openssl.cnf && \
    echo "openssl_conf = openssl_init" >> /app/ssl/openssl.cnf && \
    echo "" >> /app/ssl/openssl.cnf && \
    echo "[openssl_init]" >> /app/ssl/openssl.cnf && \
    echo "ssl_conf = ssl_sect" >> /app/ssl/openssl.cnf && \
    echo "" >> /app/ssl/openssl.cnf && \
    echo "[ssl_sect]" >> /app/ssl/openssl.cnf && \
    echo "system_default = system_default_sect" >> /app/ssl/openssl.cnf && \
    echo "" >> /app/ssl/openssl.cnf && \
    echo "[system_default_sect]" >> /app/ssl/openssl.cnf

# Set ownership for nginx directories AFTER user creation
# Use more conservative permissions for HA OS compatibility
RUN chown -R nobody:nobody /tmp/nginx-* \
    /var/lib/nginx \
    /var/cache/nginx \
    /run/nginx 2>/dev/null || true && \
    # Make directories group-writable to prevent chown errors
    chmod -R 755 /tmp/nginx-* \
    /var/lib/nginx \
    /var/cache/nginx \
    /run/nginx 2>/dev/null || true

# Set ownership of the app directory
RUN chown -R node:node /app 2>/dev/null || true
RUN chmod -R 755 /app 2>/dev/null || true

# Make app directory and node_modules more permissive for HA OS
RUN chmod -R 755 /app/node_modules 2>/dev/null || true

# Ensure node_modules has proper permissions for native modules
RUN find /app/node_modules -type d -exec chmod 755 {} \; 2>/dev/null || true
RUN find /app/node_modules -type f -exec chmod 644 {} \; 2>/dev/null || true
RUN find /app/node_modules -name "*.node" -exec chmod 755 {} \; 2>/dev/null || true

# Additional permissions for native modules in Home Assistant OS
RUN find /app/node_modules -name "*.node" -exec chown node:node {} \; 2>/dev/null || true
RUN find /app/node_modules -path "*/build/Release/*.node" -exec chmod 755 {} \; 2>/dev/null || true
RUN find /app/node_modules -path "*/build/Release/*.node" -exec chown node:node {} \; 2>/dev/null || true

# Try to set ownership of /data directory (may fail in some HA configurations, that's OK)
RUN chown -R node:node /data 2>/dev/null || echo "Warning: Could not set ownership of /data directory"

# Add Home Assistant add-on labels
LABEL \
    io.hass.version="${BUILD_VERSION}" \
    io.hass.type="addon" \
    io.hass.arch="armhf|armv7|aarch64|amd64|i386"

# Expose port 80 (nginx will serve on port 80)
EXPOSE 80

# Use run.sh as the main entry point for Home Assistant add-on
CMD ["/run.sh"]