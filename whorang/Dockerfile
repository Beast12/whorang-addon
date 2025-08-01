ARG BUILD_FROM
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install dependencies
RUN apk add --no-cache \
    nginx \
    nodejs \
    npm \
    git \
    jq \
    s6-overlay

# Copy root filesystem
COPY rootfs/ / 

# Setup application
WORKDIR /app
COPY . .

# Install Node.js dependencies
RUN npm install --production

# Expose application port
EXPOSE 3001

# Set entrypoint to s6-overlay
ENTRYPOINT ["/init"]