#!/bin/bash

# ==============================================================================
# Home Assistant Add-on: WhoRang - Docker Entrypoint
# ==============================================================================

set -e

# 1. Create data directories and set permissions.
#    This runs as root to ensure we can write to the mounted volumes.
echo "Initializing data directories..."
mkdir -p /data/uploads /data/db /config
chown -R whorun:whorun /data /config

# 2. Start nginx in the background.
echo "Starting nginx..."
nginx &

# 3. Drop privileges and execute the main application.
#    We use su-exec to run the Node.js process as the non-root 'whorun' user.
echo "Starting WhoRang backend as 'whorun' user..."
export NODE_PATH=/usr/lib/node_modules
exec su-exec whorun node /app/server.js
