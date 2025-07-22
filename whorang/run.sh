#!/usr/bin/with-contenv bashio
# ==============================================================================
# WhoRang AI Doorbell Add-on
# Main entry point for the Home Assistant add-on
# ==============================================================================

# Add bashio to path
export PATH="/usr/bin:$PATH"

# Set up logging
bashio::log.info "Starting WhoRang AI Doorbell Add-on..."

# Check if running as Home Assistant add-on
if bashio::supervisor.ping; then
    bashio::log.info "Running as Home Assistant add-on"
    export WHORANG_ADDON_MODE=true
    
    # Read configuration from add-on options
    export AI_PROVIDER=$(bashio::config 'ai_provider')
    export LOG_LEVEL=$(bashio::config 'log_level')
    export DATABASE_PATH=$(bashio::config 'database_path')
    export UPLOADS_PATH=$(bashio::config 'uploads_path')
    export MAX_UPLOAD_SIZE=$(bashio::config 'max_upload_size')
    export FACE_RECOGNITION_THRESHOLD=$(bashio::config 'face_recognition_threshold')
    export AI_ANALYSIS_TIMEOUT=$(bashio::config 'ai_analysis_timeout')
    export WEBSOCKET_ENABLED=$(bashio::config 'websocket_enabled')
    export CORS_ENABLED=$(bashio::config 'cors_enabled')
    export PUBLIC_URL=$(bashio::config 'public_url')
    
    # Handle CORS origins array
    CORS_ORIGINS=""
    for origin in $(bashio::config 'cors_origins'); do
        if [ -z "$CORS_ORIGINS" ]; then
            CORS_ORIGINS="$origin"
        else
            CORS_ORIGINS="$CORS_ORIGINS,$origin"
        fi
    done
    export CORS_ORIGINS
    
    bashio::log.info "Configuration loaded from Home Assistant add-on options"
else
    bashio::log.info "Running as standalone Docker container"
    export WHORANG_ADDON_MODE=false
fi

# Set Node.js environment
export NODE_ENV=production
export PORT=3001

# Log configuration summary
bashio::log.info "Configuration Summary:"
bashio::log.info "  - Add-on mode: $WHORANG_ADDON_MODE"
bashio::log.info "  - AI Provider: ${AI_PROVIDER:-local}"
bashio::log.info "  - Log Level: ${LOG_LEVEL:-info}"
bashio::log.info "  - Database Path: ${DATABASE_PATH:-/data/whorang.db}"
bashio::log.info "  - Uploads Path: ${UPLOADS_PATH:-/data/uploads}"

# Execute the main startup script
bashio::log.info "Executing main startup script..."
exec /docker-entrypoint.sh
