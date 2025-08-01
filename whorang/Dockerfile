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