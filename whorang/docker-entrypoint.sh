#!/bin/sh

echo "🚀 Starting WhoRang AI Doorbell Backend with Nginx..."
date +"[%T] Bootstrap start"

# Load configuration and validate user-configured paths
echo "🔧 Loading configuration..."
date +"[%T] Reading configuration from multiple sources"

# Check if running as Home Assistant add-on
if [ -f "/data/options.json" ]; then
    echo "✅ Running as Home Assistant add-on"
    echo "📖 Configuration will be read from /data/options.json"
    export WHORANG_ADDON_MODE=true
else
    echo "ℹ️  Running as standalone Docker container"
    echo "📖 Configuration will be read from environment variables"
    export WHORANG_ADDON_MODE=false
fi

# Set up nginx directories based on deployment mode
echo "📁 Setting up nginx directories..."
date +"[%T] Creating nginx directory structure"

if [ "$WHORANG_ADDON_MODE" = "true" ]; then
    echo "ℹ️  Home Assistant add-on mode - using writable temp directories"
    # Create writable temp directories for HA add-on
    mkdir -p /tmp/nginx-client-body \
        /tmp/nginx-proxy \
        /tmp/nginx-fastcgi \
        /tmp/nginx-uwsgi \
        /tmp/nginx-scgi
    
    echo "✅ Created nginx temp directories in /tmp"
    echo "ℹ️  Skipping system directory ownership changes (not permitted in HA add-on)"
else
    echo "ℹ️  Standalone Docker mode - using system directories"
    # Create all nginx directories that were defined in Dockerfile
    mkdir -p /var/lib/nginx/logs \
        /var/lib/nginx/tmp \
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
        /var/log/nginx \
        /run/nginx

    echo "✅ Created nginx directory structure"

    # Set comprehensive nginx ownership and permissions
    date +"[%T] Setting nginx ownership and permissions"
    chown -R nginx:nginx /var/lib/nginx \
        /var/cache/nginx \
        /var/log/nginx \
        /run/nginx

    chmod -R 755 /var/lib/nginx \
        /var/cache/nginx \
        /var/log/nginx \
        /run/nginx

    echo "✅ Set nginx permissions"
fi

# Create default application directories (fallback)
echo "📁 Setting up application directories..."
date +"[%T] Creating application fallback directories"
mkdir -p /app/uploads/faces /app/uploads/temp /app/uploads/thumbnails /app/data

if [ "$WHORANG_ADDON_MODE" = "true" ]; then
    echo "ℹ️  Skipping application directory ownership changes (not permitted in HA add-on)"
else
    chown -R node:node /app/uploads /app/data
    chmod -R 755 /app/uploads /app/data
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
if su-exec node touch /data/test_write 2>/dev/null; then
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

# Validate nginx configuration before starting
echo "🔍 Validating nginx configuration..."
date +"[%T] Running nginx configuration test"
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed"
    echo "📋 Nginx configuration details:"
    nginx -T 2>&1 | head -20
    exit 1
fi

# Start nginx
echo "🌐 Starting nginx..."
date +"[%T] Starting nginx daemon"
nginx

# Wait for nginx to start and verify
sleep 3

if pgrep nginx > /dev/null; then
    echo "✅ Nginx started successfully"
    echo "📊 Nginx is serving on port 80"
    echo "🔗 Health check available at /health"
else
    echo "❌ Failed to start nginx"
    echo "📋 Checking nginx error logs:"
    cat /tmp/nginx-error.log 2>/dev/null || cat /var/log/nginx/error.log 2>/dev/null || echo "No error log available"
    exit 1
fi

date +"[%T] Nginx ready"

# Final configuration summary
echo "📋 Configuration Summary:"
echo "  - Add-on mode: $WHORANG_ADDON_MODE"
echo "  - Data writable: $DATA_WRITABLE"
echo "  - Nginx: Running on port 80"
echo "  - Backend: Will start on port 3001"
echo "  - Integration: Ready for Home Assistant discovery"

# Switch to node user and start the Node.js application
echo "🚀 Starting Node.js application as user 'node'..."
date +"[%T] Starting Node.js backend"
exec su-exec node npm start
