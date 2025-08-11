#!/usr/bin/with-contenv bashio
# ==============================================================================
# Home Assistant Add-on: WhoRang - Data Initialization
# ==============================================================================

bashio::log.info "Initializing WhoRang addon data directories..."

# FIXED: Create directories WITHOUT chown operations (HA containers handle permissions)
# Only create directory structure - permissions are inherited from parent
mkdir -p /data/uploads/temp
mkdir -p /data/uploads/faces  
mkdir -p /data/uploads/thumbnails
mkdir -p /data/db

# FIXED: Use bashio for configuration access instead of manual JSON parsing
AI_PROVIDER=$(bashio::config 'ai_provider' 'local')
LOG_LEVEL=$(bashio::config 'log_level' 'info')
DATABASE_PATH=$(bashio::config 'database_path' '/data/whorang.db')
UPLOADS_PATH=$(bashio::config 'uploads_path' '/data/uploads')

bashio::log.info "Configuration loaded:"
bashio::log.info "  AI Provider: ${AI_PROVIDER}"
bashio::log.info "  Log Level: ${LOG_LEVEL}"
bashio::log.info "  Database Path: ${DATABASE_PATH}"
bashio::log.info "  Uploads Path: ${UPLOADS_PATH}"

# Export environment variables for the application
export WHORANG_AI_PROVIDER="${AI_PROVIDER}"
export WHORANG_LOG_LEVEL="${LOG_LEVEL}"
export WHORANG_DATABASE_PATH="${DATABASE_PATH}"
export WHORANG_UPLOADS_PATH="${UPLOADS_PATH}"
export WHORANG_ADDON_MODE="true"

bashio::log.info "Data directories initialized successfully (no chown operations needed)"
