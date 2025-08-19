# Use Home Assistant base image (Alpine-based)
ARG BUILD_FROM
FROM ${BUILD_FROM}

# Set shell to bash with pipefail for safer script execution
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Set up environment variables
ENV LANG=C.UTF-8
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2
ENV S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0

# Install Node.js, build tools, and other dependencies using Alpine package manager
RUN apk add --no-cache \
        build-base \
        python3 \
        jq \
        nginx \
        nodejs \
        npm \
        openssl \
        sqlite \
        gettext \
        git \
        cairo-dev \
        jpeg-dev \
        pango-dev \
        giflib-dev \
        librsvg-dev \
        pkgconfig && \
    echo "Searching for glib-object.h" && \
    find /usr/include -name "glib-object.h" 2>/dev/null || echo "glib-object.h not found, but build should continue"

# Copy the addon's root filesystem (service definitions, etc.)
COPY ../rootfs/ /
RUN chmod +x -R /etc/cont-init.d /etc/services.d

# Set up the Node.js application directory
WORKDIR /app

# FIXED: Use standard HA addon user/group (abc:abc with UID/GID 911)
# This follows Home Assistant addon best practices
RUN addgroup -g 911 -S abc && \
    adduser -u 911 -D -S -G abc abc

# Copy package files and install dependencies
# Use --no-cache to reduce image size
COPY package*.json ./
RUN npm cache clean --force && npm install --unsafe-perm --no-cache

# Copy the rest of the application source code
COPY . .

# FIXED: Create directories with proper ownership from start (no chown in init scripts)
# Create nginx temp directories that are writable in HA containers
RUN mkdir -p /tmp/nginx-client-body /tmp/nginx-proxy /tmp/nginx-fastcgi /tmp/nginx-uwsgi /tmp/nginx-scgi && \
    mkdir -p /var/log/nginx /var/lib/nginx /var/lib/nginx/logs && \
    mkdir -p /etc/nginx/conf.d && \
    cp /app/nginx.conf /etc/nginx/nginx.conf && \
    cp /app/backend.conf /etc/nginx/conf.d/default.conf && \
    rm -f /etc/nginx/http.d/default.conf && \
    chown -R abc:abc /app /tmp/nginx-* /var/log/nginx /var/lib/nginx && \
    chmod -R 755 /tmp/nginx-* /var/log/nginx /var/lib/nginx

# Expose the application port
EXPOSE 3001