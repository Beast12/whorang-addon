# Use the community addon base image for Debian
ARG BUILD_FROM="ghcr.io/hassio-addons/debian-base:7.8.3"
FROM ${BUILD_FROM}

# Set shell to bash with pipefail for safer script execution
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Set up environment variables
ENV LANG C.UTF-8

# Install Node.js, build tools, and other dependencies
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
        librsvg-dev && \
    echo "Searching for glib-object.h" && \
    find /usr/include -name "glib-object.h"

# Copy the addon's root filesystem (service definitions, etc.)
COPY ../rootfs/ /
RUN chmod +x -R /etc/cont-init.d /etc/services.d

# Set up the Node.js application directory
WORKDIR /app

# Create a non-root user for the application to run as
RUN addgroup --system whorun && \
    adduser --system --ingroup whorun --no-create-home whorun

# Copy package files and install dependencies
# Use --no-cache to reduce image size
COPY package*.json ./
RUN npm cache clean --force && npm install --unsafe-perm --no-cache

# Copy the rest of the application source code
COPY . .

# Set correct ownership for the application directory
RUN chown -R whorun:whorun /app

# Expose the application port
EXPOSE 3001