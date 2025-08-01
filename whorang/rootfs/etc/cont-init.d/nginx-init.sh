#!/command/with-contenv bash
# ==============================================================================
# Home Assistant Add-on: WhoRang - Nginx Initialization
# ==============================================================================

echo "Initializing Nginx configuration..."

# Remove default nginx configurations that might conflict
rm -f /etc/nginx/sites-enabled/* 2>/dev/null || true
rm -f /etc/nginx/sites-available/* 2>/dev/null || true

# Check if running in standalone mode and adjust access control
if [ "$WHORANG_ADDON_MODE" = "false" ]; then
    echo "Standalone mode detected. Allowing all access."
    # Replace restrictive access control with 'allow all' for standalone mode
    sed -i '/allow 172\.30\.32\.2;/,/# Note: In standalone mode, run\.sh will replace this with/c\
    # Standalone mode - allow all access\
    allow all;' /etc/nginx/conf.d/default.conf 2>/dev/null || true
fi

# Validate nginx configuration
if ! nginx -t; then
    echo "[ERROR] Nginx configuration test failed. Exiting."
    exit 1
fi

echo "Nginx configuration initialized successfully."
