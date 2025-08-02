# Use the official Node.js 20 LTS on Alpine as the base image
# This provides a stable, consistent environment for building native modules.
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Install essential runtime dependencies and build tools for native modules.
# build-base is a meta-package that includes gcc, g++, make, etc.
RUN apk add --no-cache \
    bash \
    nginx \
    sqlite \
    gettext \
    jq \
    curl \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    build-base \
    python3 \
    git \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev

# Copy application files
COPY . .

# Install Node.js dependencies. Native modules will be compiled against the
# libraries and Node.js version provided by the base image.
RUN npm install --unsafe-perm

# Remove build-time dependencies to keep the final image lean.
RUN apk del --no-cache --purge \
    build-base \
    python3 \
    git \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    && rm -rf /root/.npm /tmp/*

# The base image 'node:20-alpine' already includes a non-root user 'node' (UID/GID 1000).
# We will use this existing user instead of creating a new one.

# Set ownership of the app directory to the 'node' user
RUN chown -R node:node /app

# Copy the root filesystem for the s6-overlay
# This must be done AFTER chown to ensure root owns the s6 setup.
COPY rootfs /

# Make s6-overlay scripts executable
RUN chmod +x -R /etc/cont-init.d /etc/services.d

# Set environment variables for Home Assistant integration
ENV LANG C.UTF-8
ENV SUPERVISOR_TOKEN="${SUPERVISOR_TOKEN}"

# Expose the application port
EXPOSE 3001

# Start the s6-overlay process manager
CMD [ "/init" ]