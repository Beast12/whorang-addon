ARG BUILD_FROM

# Use a single stage build based on the Home Assistant base image
FROM $BUILD_FROM

ARG BUILD_ARCH

WORKDIR /app

# 1. Install build-time dependencies, runtime dependencies, and necessary packages for native modules.
#    Using --virtual .build-dependencies allows us to easily remove them later.
RUN apk add --no-cache --virtual .build-dependencies \
        build-base \
        linux-headers \
        python3-dev \
        git \
        make \
        g++ \
        cairo-dev \
        jpeg-dev \
        pango-dev \
        musl-dev \
        giflib-dev \
        pixman-dev \
        pangomm-dev \
        libjpeg-turbo-dev \
        freetype-dev \
    && apk add --no-cache \
        bash \
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
        freetype

# 2. Copy application files
COPY . .

# 3. Install npm packages, including native modules.
#    --unsafe-perm is critical for native module build scripts to run correctly as root.
RUN npm install --unsafe-perm

# 4. Clean up.
#    Remove the build-time dependencies and clear caches to keep the image small.
RUN apk del --no-cache --purge .build-dependencies \
    && rm -rf /root/.npm /tmp/*

# 5. Set ownership and permissions.
#    Create a non-root user and ensure all files are owned by it.
#    This is critical for security and Home Assistant compatibility.
RUN mkdir -p /data /config /var/lib/nginx /var/log/nginx /run/nginx && \
    addgroup -S -g 1000 whorun && \
    adduser -S -u 1000 -G whorun whorun && \
    chown -R whorun:whorun /app /data /config /var/lib/nginx /var/log/nginx /run/nginx /tmp

# 6. Ensure scripts are executable
RUN chmod +x /app/docker-entrypoint.sh

# 7. Set environment variables
ENV NODE_ENV=production
ENV SUPERVISOR_TOKEN=$SUPERVISOR_TOKEN
ENV WHORANG_ADDON_MODE=true

# 8. Expose the application port
EXPOSE 3001

# 9. Switch to the non-root user
USER whorun

ENTRYPOINT ["/app/docker-entrypoint.sh"]