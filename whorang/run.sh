#!/bin/sh
# ==============================================================================
# WhoRang AI Doorbell Add-on
# Main entry point for the Home Assistant add-on
# ==============================================================================

# Add bashio to path if available
export PATH="/usr/bin:$PATH"

# Function to log messages (works in both HA and standalone modes)
log_info() {
    if command -v bashio >/dev/null 2>&1 && bashio::supervisor.ping 2>/dev/null; then
        bashio::log.info "$1"
    else
        echo "[INFO] $1"
    fi
}

# Set up logging
log_info "Starting WhoRang AI Doorbell Add-on..."

# Check if running as Home Assistant add-on
if command -v bashio >/dev/null 2>&1 && bashio::supervisor.ping 2>/dev/null; then
    log_info "Running as Home Assistant add-on"
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
    
    log_info "Configuration loaded from Home Assistant add-on options"
else
    log_info "Running as standalone Docker container"
    export WHORANG_ADDON_MODE=false
    
    # Set default values for standalone mode
    export AI_PROVIDER=${AI_PROVIDER:-local}
    export LOG_LEVEL=${LOG_LEVEL:-info}
    export DATABASE_PATH=${DATABASE_PATH:-/data/whorang.db}
    export UPLOADS_PATH=${UPLOADS_PATH:-/data/uploads}
    export MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE:-10}
    export FACE_RECOGNITION_THRESHOLD=${FACE_RECOGNITION_THRESHOLD:-0.8}
    export AI_ANALYSIS_TIMEOUT=${AI_ANALYSIS_TIMEOUT:-30}
    export WEBSOCKET_ENABLED=${WEBSOCKET_ENABLED:-true}
    export CORS_ENABLED=${CORS_ENABLED:-true}
    export CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:8080}
    export PUBLIC_URL=${PUBLIC_URL:-}
fi

# Set Node.js environment
export NODE_ENV=production
export PORT=3001

# Log configuration summary
log_info "Configuration Summary:"
log_info "  - Add-on mode: $WHORANG_ADDON_MODE"
log_info "  - AI Provider: ${AI_PROVIDER:-local}"
log_info "  - Log Level: ${LOG_LEVEL:-info}"
log_info "  - Database Path: ${DATABASE_PATH:-/data/whorang.db}"
log_info "  - Uploads Path: ${UPLOADS_PATH:-/data/uploads}"
log_info "  - Max Upload Size: ${MAX_UPLOAD_SIZE:-10MB}"
log_info "  - Face Recognition Threshold: ${FACE_RECOGNITION_THRESHOLD:-0.6}"
log_info "  - AI Analysis Timeout: ${AI_ANALYSIS_TIMEOUT:-30}"
log_info "  - WebSocket Enabled: ${WEBSOCKET_ENABLED:-true}"
log_info "  - CORS Enabled: ${CORS_ENABLED:-true}"
log_info "  - CORS Origins: ${CORS_ORIGINS:-*}"
log_info "  - Public URL: ${PUBLIC_URL:-}"

# Execute the main startup script
log_info "Executing main startup script..."
exec /docker-entrypoint.sh
