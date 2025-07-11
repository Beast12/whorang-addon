#!/usr/bin/with-contenv bashio

# ==============================================================================
# WhoRang AI Doorbell Backend Add-on
# Starts the WhoRang backend service
# ==============================================================================

# Set default values
declare port
declare ssl
declare certfile
declare keyfile
declare ai_provider
declare log_level
declare database_path
declare uploads_path

# Read configuration from options
port=$(bashio::config 'port' '3001')
ssl=$(bashio::config 'ssl')
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')
ai_provider=$(bashio::config 'ai_provider')
log_level=$(bashio::config 'log_level')
database_path=$(bashio::config 'database_path')
uploads_path=$(bashio::config 'uploads_path')

# Create necessary directories
bashio::log.info "Creating data directories..."
mkdir -p "$(dirname "${database_path}")"
mkdir -p "${uploads_path}/faces"
mkdir -p /data/ssl

# Set permissions
chmod 755 "$(dirname "${database_path}")"
chmod 755 "${uploads_path}"
chmod 755 "${uploads_path}/faces"

# SSL Configuration
if bashio::config.true 'ssl'; then
    bashio::log.info "SSL is enabled. Setting up certificates..."
    
    # Check if certificates exist
    if bashio::config.has_value 'certfile' && bashio::config.has_value 'keyfile'; then
        if bashio::fs.file_exists "/ssl/${certfile}" && bashio::fs.file_exists "/ssl/${keyfile}"; then
            bashio::log.info "Using SSL certificate: ${certfile}"
            export SSL_CERT_PATH="/ssl/${certfile}"
            export SSL_KEY_PATH="/ssl/${keyfile}"
            export USE_SSL="true"
        else
            bashio::log.warning "SSL certificates not found, falling back to HTTP"
            export USE_SSL="false"
        fi
    else
        bashio::log.warning "SSL enabled but certificate files not specified"
        export USE_SSL="false"
    fi
else
    bashio::log.info "SSL is disabled"
    export USE_SSL="false"
fi

# Environment variables
export NODE_ENV="production"
export PORT="${port}"
export LOG_LEVEL="${log_level}"
export DATABASE_PATH="${database_path}"
export UPLOADS_PATH="${uploads_path}"
export AI_PROVIDER="${ai_provider}"

# Additional configuration from add-on options
export MAX_UPLOAD_SIZE=$(bashio::config 'max_upload_size')
export FACE_RECOGNITION_THRESHOLD=$(bashio::config 'face_recognition_threshold')
export AI_ANALYSIS_TIMEOUT=$(bashio::config 'ai_analysis_timeout')
export WEBSOCKET_ENABLED=$(bashio::config 'websocket_enabled')
export CORS_ENABLED=$(bashio::config 'cors_enabled')

# CORS origins
if bashio::config.has_value 'cors_origins'; then
    cors_origins=$(bashio::config 'cors_origins')
    export CORS_ORIGINS="${cors_origins}"
fi

# Home Assistant integration
if bashio::supervisor.ping; then
    bashio::log.info "Home Assistant Supervisor detected"
    export HASSIO_TOKEN="${SUPERVISOR_TOKEN}"
    export HASSIO_API="http://supervisor/core/api"
fi

# Database initialization
bashio::log.info "Initializing database..."
if [[ ! -f "${database_path}" ]]; then
    bashio::log.info "Creating new database at ${database_path}"
    touch "${database_path}"
    chmod 644 "${database_path}"
fi

# Copy backend files if they don't exist
if [[ ! -f "/app/server.js" ]]; then
    bashio::log.info "Copying WhoRang backend files..."
    cp -r /usr/src/app/* /app/
fi

# Install additional dependencies if needed
if [[ -f "/app/package.json" ]] && [[ ! -d "/app/node_modules" ]]; then
    bashio::log.info "Installing Node.js dependencies..."
    cd /app
    npm ci --only=production
fi

# Health check function
health_check() {
    local retries=0
    local max_retries=30
    
    while [[ ${retries} -lt ${max_retries} ]]; do
        if curl -f -s "http://localhost:${port}/api/health" > /dev/null 2>&1; then
            bashio::log.info "WhoRang backend is healthy"
            return 0
        fi
        
        retries=$((retries + 1))
        bashio::log.debug "Health check attempt ${retries}/${max_retries}"
        sleep 2
    done
    
    bashio::log.error "WhoRang backend failed to start properly"
    return 1
}

# Signal handlers for graceful shutdown
shutdown_handler() {
    bashio::log.info "Received shutdown signal, stopping WhoRang backend..."
    if [[ -n "${WHORANG_PID}" ]]; then
        kill -TERM "${WHORANG_PID}" 2>/dev/null || true
        wait "${WHORANG_PID}" 2>/dev/null || true
    fi
    bashio::log.info "WhoRang backend stopped"
    exit 0
}

# Set up signal handlers
trap 'shutdown_handler' SIGTERM SIGINT

# Log configuration
bashio::log.info "Starting WhoRang AI Doorbell Backend..."
bashio::log.info "Port: ${port}"
bashio::log.info "SSL: $(bashio::config 'ssl')"
bashio::log.info "AI Provider: ${ai_provider}"
bashio::log.info "Log Level: ${log_level}"
bashio::log.info "Database: ${database_path}"
bashio::log.info "Uploads: ${uploads_path}"

# Change to app directory
cd /app

# Start the WhoRang backend
bashio::log.info "Starting WhoRang backend service..."

if [[ "${log_level}" == "debug" ]]; then
    # Debug mode - show all output
    node server.js &
else
    # Production mode - filter logs
    node server.js 2>&1 | while IFS= read -r line; do
        # Filter out verbose logs in production
        if [[ "${line}" =~ (ERROR|WARN|INFO) ]] || [[ "${log_level}" == "debug" ]]; then
            echo "${line}"
        fi
    done &
fi

WHORANG_PID=$!

# Wait a moment for startup
sleep 5

# Perform health check
if health_check; then
    bashio::log.info "WhoRang backend started successfully"
    
    # Show access information
    if bashio::config.true 'ssl'; then
        bashio::log.info "Web interface available at: https://$(hostname):${port}"
    else
        bashio::log.info "Web interface available at: http://$(hostname):${port}"
    fi
    
    # Show ingress information if available
    if bashio::addon.ingress_url; then
        bashio::log.info "Ingress URL: $(bashio::addon.ingress_url)"
    fi
else
    bashio::log.error "Failed to start WhoRang backend"
    exit 1
fi

# Keep the script running and wait for the backend process
wait "${WHORANG_PID}"
