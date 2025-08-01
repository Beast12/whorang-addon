#!/bin/bash

# ==============================================================================
# Home Assistant Add-on: WhoRang - Docker Entrypoint
# ==============================================================================

# 1. Set the Node.js path to include the globally installed modules.
#    This is critical for finding native dependencies installed in the Docker image.
export NODE_PATH=/app/node_modules:/data/node_modules

# 2. Set log level from addon configuration if available.
if [ -f /data/options.json ]; then
    export LOG_LEVEL=$(jq -r '.log_level // "info"' /data/options.json)
else
    export LOG_LEVEL="info"
fi

# 3. Create required data directories.
#    These are mounted from the host and persist across restarts.
mkdir -p /data/uploads/faces \
         /data/uploads/temp \
         /data/uploads/thumbnails \
         /data/db

# 4. Start nginx in the background.
echo "Starting nginx..."
/usr/sbin/nginx -c /etc/nginx/nginx.conf &

# 5. Start the Node.js application.
#    The container runs as a non-root user, so su-exec is not needed.
echo "Starting WhoRang backend..."
exec node /app/index.js
