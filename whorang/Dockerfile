ARG BUILD_FROM

# Use a single stage build based on the Home Assistant base image
FROM $BUILD_FROM

ARG BUILD_ARCH

WORKDIR /app

# 1. Install all dependencies in a single layer to optimize the build.
RUN apk add --no-cache --virtual .build-dependencies \
    # For compiling native modules
    g++ \
    make \
    python3 \
    git \
    # Dev libraries for native modules (canvas, sharp, etc.)
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    && apk add --no-cache \
    # For running the addon
    nodejs-current \
    npm \
    bash \
    nginx \
    sqlite \
    gettext \
    jq \
    curl \
    # Runtime libraries for native modules
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg

# 2. Copy application files
COPY . .

# 3. Install npm packages, including native modules.
#    --unsafe-perm is critical for native module build scripts to run correctly as root.
RUN npm install --unsafe-perm

# Create a non-root user 'whorun' for running the application
RUN addgroup -S -g 1000 whorun && \
    adduser -S -u 1000 -G whorun whorun

# 4. Set permissions.
#    Change the ownership of the application directory to the non-root user.
RUN chown -R whorun:whorun /app

# 5. Clean up.
#    Remove the build-time dependencies and clear caches to keep the image small.
RUN apk del --no-cache --purge .build-dependencies \
    && rm -rf /root/.npm /tmp/*

# 5. Copy root filesystem for s6-overlay and set permissions
COPY rootfs /
RUN chmod +x -R /etc/cont-init.d /etc/services.d

# 6. Set environment variables
ENV NODE_ENV=production
ENV SUPERVISOR_TOKEN=$SUPERVISOR_TOKEN
ENV WHORANG_ADDON_MODE=true

# 7. Expose the application port
EXPOSE 3001

# The base image provides the s6-overlay entrypoint.