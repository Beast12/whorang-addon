#!/bin/sh

echo "🚀 Starting WhoRang AI Doorbell Backend with Nginx..."
date +"[%T] Bootstrap start"

# Set OpenSSL config path to avoid permission issues
export OPENSSL_CONF="/app/ssl/openssl.cnf"

# Load configuration and validate user-configured paths
echo "🔧 Loading configuration..."
date +"[%T] Reading configuration from multiple sources"

# Check if running as Home Assistant add-on
# Respect the WHORANG_ADDON_MODE environment variable if already set (from run.sh)
if [ -z "$WHORANG_ADDON_MODE" ]; then
    if [ -f "/data/options.json" ]; then
        echo "✅ Running as Home Assistant add-on"
        echo "📖 Configuration will be read from /data/options.json"
        export WHORANG_ADDON_MODE=true
    else
        echo "ℹ️  Running as standalone Docker container"
        echo "📖 Configuration will be read from environment variables"
        export WHORANG_ADDON_MODE=false
    fi
else
    if [ "$WHORANG_ADDON_MODE" = "true" ]; then
        echo "✅ Running as Home Assistant add-on (mode set by environment)"
        echo "📖 Configuration will be read from environment variables set by run.sh"
    else
        echo "ℹ️  Running as standalone Docker container (mode set by environment)"
        echo "📖 Configuration will be read from environment variables"
    fi
fi

# Set up nginx directories based on deployment mode
echo "📁 Setting up nginx directories..."
date +"[%T] Creating nginx directory structure"

if [ "$WHORANG_ADDON_MODE" = "true" ]; then
    echo "ℹ️  Home Assistant add-on mode - using writable temp directories"
    # Create writable temp directories for HA add-on (NO LOG DIRECTORIES)
    # Use /tmp for all temp directories as it's writable in HA OS
    mkdir -p /tmp/nginx-client-body \
        /tmp/nginx-proxy \
        /tmp/nginx-fastcgi \
        /tmp/nginx-uwsgi \
        /tmp/nginx-scgi 2>/dev/null || true
    
    # Set permissions for nginx temp directories
    # In HA OS, we need to be careful with permissions
    # Use 755 for directories to prevent chown errors
    chmod -R 755 /tmp/nginx-* 2>/dev/null || true
    
    echo "✅ Created nginx temp directories in /tmp"
    echo "ℹ️  Set nginx temp directory permissions"
    echo "ℹ️  No log directories created - all logs go to stdout/stderr per HA requirements"
else
    echo "ℹ️  Standalone Docker mode - using system directories"
    # Create nginx directories (NO LOG DIRECTORIES - logs go to stdout/stderr)
    mkdir -p /var/lib/nginx/tmp \
        /var/lib/nginx/tmp/client_body \
        /var/lib/nginx/tmp/proxy_temp \
        /var/lib/nginx/tmp/fastcgi_temp \
        /var/lib/nginx/tmp/uwsgi_temp \
        /var/lib/nginx/tmp/scgi_temp \
        /var/cache/nginx \
        /var/cache/nginx/client_temp \
        /var/cache/nginx/proxy_temp \
        /var/cache/nginx/fastcgi_temp \
        /var/cache/nginx/uwsgi_temp \
        /var/cache/nginx/scgi_temp \
        /run/nginx

    echo "✅ Created nginx directory structure (no log directories)"

    # Set comprehensive nginx ownership and permissions
    date +"[%T] Setting nginx ownership and permissions"
    chown -R nobody:nobody /var/lib/nginx \
        /var/cache/nginx \
        /run/nginx 2>/dev/null || true

    # Make directories group-writable to prevent chown errors
    chmod -R 755 /var/lib/nginx \
        /var/cache/nginx \
        /run/nginx 2>/dev/null || true

    echo "✅ Set nginx permissions"
fi

# Create default application directories (fallback)
echo "📁 Setting up application directories..."
date +"[%T] Creating application fallback directories"
mkdir -p /app/uploads/faces /app/uploads/temp /app/uploads/thumbnails /app/data 2>/dev/null || true

if [ "$WHORANG_ADDON_MODE" = "true" ]; then
    echo "ℹ️  Skipping application directory ownership changes (not permitted in HA add-on)"
    # In HA mode, make directories more permissive but avoid chown
    chmod -R 755 /app/uploads /app/data 2>/dev/null || true
else
    chown -R node:node /app/uploads /app/data 2>/dev/null || true
    chmod -R 755 /app/uploads /app/data 2>/dev/null || true
fi

echo "✅ Created application directories"

# Create Home Assistant persistent directories
echo "📁 Setting up Home Assistant persistent directories..."
date +"[%T] Creating /data directories"
mkdir -p /data/uploads/faces /data/uploads/temp /data/uploads/thumbnails
echo "✅ Created /data directories"

# Test and set up user-configured paths
echo "🔍 Validating user-configured paths..."
date +"[%T] Testing path accessibility"

# Test /data directory write permissions
if touch /data/test_write 2>/dev/null; then
    rm -f /data/test_write
    echo "✅ /data directory is writable"
    export DATA_WRITABLE=true
    
    # Try to set ownership of /data directories
    chown -R node:node /data 2>/dev/null || {
        echo "⚠️  Warning: Could not set ownership for /data - this is normal in some HA configurations"
    }
    chmod -R 755 /data 2>/dev/null || {
        echo "⚠️  Warning: Could not set permissions for /data"
    }
else
    echo "⚠️  /data directory is not writable - will use fallback paths"
    export DATA_WRITABLE=false
fi

# Set up Home Assistant integration files
echo "📦 Setting up Home Assistant integration..."
date +"[%T] Handling integration files"
if [ -d "/config" ]; then
    # Running as Home Assistant addon - copy integration files to config
    mkdir -p /config/custom_components
    if [ -d "/config/custom_components/whorang" ]; then
        echo "✅ Integration files already exist in /config/custom_components/whorang"
    else
        echo "📋 Copying integration files to /config/custom_components/whorang"
        # Copy from the app directory where they should be
        if [ -d "/app/custom_components/whorang" ]; then
            cp -r /app/custom_components/whorang /config/custom_components/ 2>/dev/null && {
                echo "✅ Integration files copied successfully"
            } || {
                echo "⚠️  Warning: Could not copy integration files - they may already be present"
            }
        else
            echo "⚠️  Warning: Integration files not found in /app/custom_components/whorang"
        fi
    fi
    echo "✅ Integration files ready for Home Assistant discovery"
else
    echo "ℹ️  Not running as Home Assistant addon - integration files should be manually installed"
fi

# Set up addon_config directory for debugging access (HA add-on best practice)
if [ "$WHORANG_ADDON_MODE" = "true" ] && [ -d "/addon_config" ]; then
    echo "🔧 Setting up addon_config directory for debugging access..."
    date +"[%T] Creating addon_config structure"
    
    # Create addon_config subdirectories for organized access
    mkdir -p /addon_config/debug
    mkdir -p /addon_config/database
    
    # Create a README for users
    cat > /addon_config/README.md << 'EOF'
# WhoRang Add-on Configuration and Debug Files

This directory provides access to internal WhoRang files for debugging and configuration purposes.

## Directory Structure

### `/debug/`
- Configuration and debug information files
- System status and diagnostic information

### `/database/`
- Symlink to the WhoRang database file for direct access
- Useful for database inspection and backup

## Logging

All logs (nginx and application) are sent to stdout/stderr per Home Assistant add-on requirements.
To view logs:
1. Go to Settings → Add-ons → WhoRang AI Doorbell
2. Click on the "Log" tab
3. All nginx and application logs will be displayed there

## Usage Notes

- These files are provided for debugging and advanced configuration
- Modifying files directly may affect add-on operation
- Always backup before making changes
- All logs are available through Home Assistant's log viewer

## Support

For support and documentation, visit:
https://github.com/Beast12/whorang-addon
EOF
    
    echo "✅ addon_config directory configured for debugging access"
    echo "📋 Users can access logs and debug files via /addon_config/"
else
    echo "ℹ️  addon_config not available (not running as HA add-on or directory not mounted)"
fi

# Remove any default nginx configurations that might create log files
echo "🔍 Checking for conflicting nginx configurations..."
date +"[%T] Removing default nginx configurations"

# Remove default nginx site configurations that might override our settings
echo "⚠️  Removing default nginx site configurations"
rm -f /etc/nginx/sites-enabled/* 2>/dev/null || true
rm -f /etc/nginx/sites-available/* 2>/dev/null || true

# Remove any backup configurations
rm -f /etc/nginx/conf.d/default.conf.backup 2>/dev/null || true

echo "✅ Cleaned up default nginx configurations"

# Configure nginx access control based on deployment mode
echo "🔧 Configuring nginx access control..."
date +"[%T] Setting up access control for deployment mode"

if [ "$WHORANG_ADDON_MODE" = "false" ]; then
    echo "ℹ️  Standalone mode detected - allowing all access"
    # Replace restrictive access control with allow all for standalone mode
    sed -i '/allow 172\.30\.32\.2;/,/# Note: In standalone mode, run\.sh will replace this with/c\
    # Standalone mode - allow all access\
    allow all;' /etc/nginx/conf.d/default.conf 2>/dev/null || true
    echo "✅ Configured nginx for standalone mode (allow all)"
else
    echo "ℹ️  Home Assistant add-on mode - using restrictive access control"
    echo "✅ Nginx configured for HA add-on mode (restricted access)"
fi

# Validate nginx configuration for Home Assistant compliance
echo "🔍 Validating nginx configuration for Home Assistant compliance..."
date +"[%T] Running nginx configuration test and compliance check"

# First, test nginx configuration syntax
nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration test failed"
    echo "📋 Nginx configuration details:"
    nginx -T 2>&1 | head -20
    exit 1
fi

# Check for file-based logging (violates HA add-on requirements)
echo "🔍 Checking for file-based logging violations..."
if nginx -T 2>&1 | grep -E "(error_log|access_log).*\.(log|txt)" | grep -v "/dev/std" | grep -v "off"; then
    echo "❌ Found file-based logging in nginx config - this violates HA add-on requirements"
    echo "📋 All logs must go to stdout/stderr only"
    echo "📋 Problematic log configurations:"
    nginx -T 2>&1 | grep -E "(error_log|access_log).*\.(log|txt)" | grep -v "/dev/std" | grep -v "off"
    exit 1
fi

echo "✅ Nginx configuration is valid and Home Assistant compliant"
echo "✅ All logs properly configured for stdout/stderr output"

# Final configuration summary
echo "📋 Configuration Summary:"
echo "  - Add-on mode: $WHORANG_ADDON_MODE"
echo "  - Data writable: $DATA_WRITABLE"
echo "  - Nginx: Will be started by s6"
echo "  - Backend: Will be started by s6"
echo "  - Integration: Ready for Home Assistant discovery"

date +"[%T] Initialization complete"