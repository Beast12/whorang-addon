#!/usr/bin/with-contenv bash
# ==============================================================================
# Home Assistant Add-on: WhoRang - Data Initialization
# ==============================================================================

# FIXED: Detect environment and use appropriate logging/config method
if command -v bashio >/dev/null 2>&1 && [ -n "${SUPERVISOR_TOKEN:-}" ]; then
    # Home Assistant addon mode - use bashio
    LOG_FUNC="bashio::log.info"
    CONFIG_FUNC="bashio::config"
    MODE="addon"
else
    # Standalone/test mode - use echo fallback
    LOG_FUNC="echo [INFO]"
    CONFIG_FUNC="echo"
    MODE="standalone"
fi

$LOG_FUNC "Initializing WhoRang data directories (${MODE} mode)..."

# Create directories WITHOUT chown operations (HA containers handle permissions)
# Only create directory structure - permissions are inherited from parent
mkdir -p /data/uploads/temp
mkdir -p /data/uploads/faces  
mkdir -p /data/uploads/thumbnails
mkdir -p /data/db

# FIXED: Use environment-appropriate configuration access
if [ "$MODE" = "addon" ]; then
    # Home Assistant addon mode - use bashio
    AI_PROVIDER=$(bashio::config 'ai_provider' 'local')
    LOG_LEVEL=$(bashio::config 'log_level' 'info')
    DATABASE_PATH=$(bashio::config 'database_path' '/data/whorang.db')
    UPLOADS_PATH=$(bashio::config 'uploads_path' '/data/uploads')
else
    # Standalone/test mode - use environment variables or defaults
    AI_PROVIDER="${AI_PROVIDER:-local}"
    LOG_LEVEL="${LOG_LEVEL:-info}"
    DATABASE_PATH="${DATABASE_PATH:-/data/whorang.db}"
    UPLOADS_PATH="${UPLOADS_PATH:-/data/uploads}"
fi

$LOG_FUNC "Configuration loaded:"
$LOG_FUNC "  AI Provider: ${AI_PROVIDER}"
$LOG_FUNC "  Log Level: ${LOG_LEVEL}"
$LOG_FUNC "  Database Path: ${DATABASE_PATH}"
$LOG_FUNC "  Uploads Path: ${UPLOADS_PATH}"

# Export environment variables for the application
export WHORANG_AI_PROVIDER="${AI_PROVIDER}"
export WHORANG_LOG_LEVEL="${LOG_LEVEL}"
export WHORANG_DATABASE_PATH="${DATABASE_PATH}"
export WHORANG_UPLOADS_PATH="${UPLOADS_PATH}"
export WHORANG_ADDON_MODE="${MODE}"

$LOG_FUNC "Data directories initialized successfully (no chown operations needed)"
