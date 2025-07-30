#!/bin/sh
# ==============================================================================
# WhoRang AI Doorbell Add-on
# Main entry point for the Home Assistant add-on
# ==============================================================================

# Source bashio library if available
# Note: In test environments, bashio may not be available or may have syntax errors
# We handle this gracefully with fallbacks
BASHIO_AVAILABLE=false
if [ -f "/usr/lib/bashio/bashio.sh" ]; then
    # shellcheck source=/usr/lib/bashio/bashio.sh
    if source /usr/lib/bashio/bashio.sh 2>/dev/null; then
        BASHIO_AVAILABLE=true
    fi
elif [ -f "/usr/bin/bashio" ]; then
    # shellcheck source=/usr/bin/bashio
    if source /usr/bin/bashio 2>/dev/null; then
        BASHIO_AVAILABLE=true
    fi
fi

# Function to log messages (works in both HA and standalone modes)
log_info() {
    if [ "$BASHIO_AVAILABLE" = "true" ] && command -v bashio >/dev/null 2>&1 && bashio::supervisor.ping 2>/dev/null; then
        bashio::log.info "$1"
    else
        echo "[INFO] $1"
    fi
}

# Set up logging
log_info "Starting WhoRang AI Doorbell Add-on..."

# Check if running as Home Assistant add-on using multiple detection methods
WHORANG_ADDON_MODE=false

# Method 1: Check for bashio and supervisor connectivity
if command -v bashio >/dev/null 2>&1 && bashio::supervisor.ping 2>/dev/null; then
    log_info "Running as Home Assistant add-on (detected via bashio)"
    WHORANG_ADDON_MODE=true
# Method 2: Check for options.json file
elif [ -f "/data/options.json" ]; then
    log_info "Running as Home Assistant add-on (detected via /data/options.json)"
    WHORANG_ADDON_MODE=true
# Method 3: Check for supervisor API
elif [ -n "$SUPERVISOR_TOKEN" ] && curl -s -f -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/supervisor/ping >/dev/null 2>&1; then
    log_info "Running as Home Assistant add-on (detected via supervisor API)"
    WHORANG_ADDON_MODE=true
fi

export WHORANG_ADDON_MODE

if [ "$WHORANG_ADDON_MODE" = "true" ]; then
    # Read configuration from add-on options
    if [ "$BASHIO_AVAILABLE" = "true" ] && command -v bashio >/dev/null 2>&1 && bashio::supervisor.ping 2>/dev/null; then
        # Use bashio if available
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
    else
        # Fallback to reading options.json directly
        log_info "Reading configuration from /data/options.json"
        export AI_PROVIDER=$(jq -r '.ai_provider // "local"' /data/options.json 2>/dev/null || echo "local")
        export LOG_LEVEL=$(jq -r '.log_level // "info"' /data/options.json 2>/dev/null || echo "info")
        export DATABASE_PATH=$(jq -r '.database_path // "/data/whorang.db"' /data/options.json 2>/dev/null || echo "/data/whorang.db")
        export UPLOADS_PATH=$(jq -r '.uploads_path // "/data/uploads"' /data/options.json 2>/dev/null || echo "/data/uploads")
        export MAX_UPLOAD_SIZE=$(jq -r '.max_upload_size // "10"' /data/options.json 2>/dev/null || echo "10")
        export FACE_RECOGNITION_THRESHOLD=$(jq -r '.face_recognition_threshold // 0.8' /data/options.json 2>/dev/null || echo "0.8")
        export AI_ANALYSIS_TIMEOUT=$(jq -r '.ai_analysis_timeout // 30' /data/options.json 2>/dev/null || echo "30")
        export WEBSOCKET_ENABLED=$(jq -r '.websocket_enabled // true' /data/options.json 2>/dev/null || echo "true")
        export CORS_ENABLED=$(jq -r '.cors_enabled // true' /data/options.json 2>/dev/null || echo "true")
        export PUBLIC_URL=$(jq -r '.public_url // ""' /data/options.json 2>/dev/null || echo "")
        
        # Handle CORS origins array
        CORS_ORIGINS=""
        if jq -e '.cors_origins | type == "array"' /data/options.json >/dev/null 2>&1; then
            for origin in $(jq -r '.cors_origins[]' /data/options.json 2>/dev/null); do
                if [ -z "$CORS_ORIGINS" ]; then
                    CORS_ORIGINS="$origin"
                else
                    CORS_ORIGINS="$CORS_ORIGINS,$origin"
                fi
            done
        else
            CORS_ORIGINS="*"
        fi
        export CORS_ORIGINS
    fi
    
    log_info "Configuration loaded from Home Assistant add-on options"
else
    log_info "Running as standalone Docker container"
    
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

# Export all configuration variables so they're available to services
export WHORANG_ADDON_MODE
export AI_PROVIDER
export LOG_LEVEL
export DATABASE_PATH
export UPLOADS_PATH
export MAX_UPLOAD_SIZE
export FACE_RECOGNITION_THRESHOLD
export AI_ANALYSIS_TIMEOUT
export WEBSOCKET_ENABLED
export CORS_ENABLED
export CORS_ORIGINS
export PUBLIC_URL

# In standalone mode, we still need to do some setup that would normally be done by docker-entrypoint.sh
if [ "$WHORANG_ADDON_MODE" = "false" ]; then
    log_info "Running in standalone mode - performing additional setup..."
    
    # Remove default nginx configurations that might conflict
    rm -f /etc/nginx/sites-enabled/* 2>/dev/null || true
    rm -f /etc/nginx/sites-available/* 2>/dev/null || true
    
    # Check if running in standalone mode and adjust access control
    if [ "$WHORANG_ADDON_MODE" = "false" ]; then
        # Replace restrictive access control with allow all for standalone mode
        sed -i '/allow 172\.30\.32\.2;/,/# Note: In standalone mode, run\.sh will replace this with/c\
        # Standalone mode - allow all access\
        allow all;' /etc/nginx/conf.d/default.conf 2>/dev/null || true
    fi
    
    # Validate nginx configuration
    if ! nginx -t; then
        log_info "Nginx configuration test failed"
        exit 1
    fi
fi

log_info "Starting s6 service manager..."
# The s6 service manager will start our services
exec /init
