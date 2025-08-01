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

# Copy root filesystem and set permissions
COPY rootfs/ / 
RUN chmod +x -R /etc/cont-init.d /etc/services.d 

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY backend.conf /etc/nginx/conf.d/backend.conf 

# Setup application
WORKDIR /app
COPY . .

# Install Node.js dependencies
RUN npm install --production

# Expose application port
EXPOSE 3001

# Set entrypoint to s6-overlay
ENTRYPOINT ["/init"]