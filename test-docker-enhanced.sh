#!/bin/bash

# Enhanced test script to verify Docker container with mocked bashio

echo "=== WhoRang Docker Container Test with Mocked Bashio ==="

echo "Creating test environment..."

# Create test directories
mkdir -p /tmp/whorang-test/data
mkdir -p /tmp/whorang-test/config

# Create a mock options.json with custom paths
cat > /tmp/whorang-test/data/options.json << 'EOF'
{
  "database_path": "/data/whorang-custom.db",
  "uploads_path": "/data/uploads-custom",
  "ai_provider": "local",
  "log_level": "debug",
  "websocket_enabled": true,
  "cors_enabled": true,
  "cors_origins": ["*"],
  "public_url": "",
  "max_upload_size": "10MB",
  "face_recognition_threshold": 0.6,
  "ai_analysis_timeout": 30
}
EOF
echo "Created mock Home Assistant options.json with custom paths:"
cat /tmp/whorang-test/data/options.json
echo ""

# Create a mock bashio script
cat > /tmp/whorang-test/bashio << 'EOF'
#!/bin/bash

case "$1" in
  "supervisor.ping")
    # Always succeed to indicate we're in HA add-on mode
    exit 0
    ;;
  "config")
    # Return values based on the option requested
    case "$2" in
      "database_path")
        echo "/data/whorang-custom.db"
        ;;
      "uploads_path")
        echo "/data/uploads-custom"
        ;;
      "ai_provider")
        echo "local"
        ;;
      "log_level")
        echo "debug"
        ;;
      "websocket_enabled")
        echo "true"
        ;;
      "cors_enabled")
        echo "true"
        ;;
      "cors_origins")
        # Return as a list that can be iterated
        echo "*"
        ;;
      "public_url")
        echo ""
        ;;
      "max_upload_size")
        echo "10MB"
        ;;
      "face_recognition_threshold")
        echo "0.6"
        ;;
      "ai_analysis_timeout")
        echo "30"
        ;;
    esac
    ;;
  "log.info")
    echo "[BASHIO] $2"
    ;;
esac
EOF

chmod +x /tmp/whorang-test/bashio
echo "Created mock bashio script"

echo ""
echo "Building test Docker image with bashio..."

# Create a temporary Dockerfile for testing
cat > /tmp/whorang-test/Dockerfile << 'EOF'
FROM whorang-test

# Copy the mock bashio script
COPY bashio /usr/bin/bashio
RUN chmod +x /usr/bin/bashio

# Ensure the data directory exists
RUN mkdir -p /data
EOF

# Build the test image
docker build -t whorang-test-enhanced /tmp/whorang-test

echo ""
echo "Starting Docker container with enhanced test configuration..."

docker run -d \
  --name whorang-test-enhanced \
  -v /tmp/whorang-test/data:/data \
  -v /tmp/whorang-test/config:/config \
  whorang-test-enhanced

echo "Container started. Waiting for initialization..."
sleep 15

echo ""
echo "Checking container logs for configuration loading..."
docker logs whorang-test-enhanced 2>&1 | grep -A 30 "Configuration Summary"

echo ""
echo "Checking for any permission errors..."
docker logs whorang-test-enhanced 2>&1 | grep -i "permission\|error\|EACCES" || echo "No permission errors found"

echo ""
echo "Checking if native modules are loading..."
docker logs whorang-test-enhanced 2>&1 | grep -i "better-sqlite3\|sharp\|canvas" || echo "No native module loading messages found"

echo ""
echo "Checking if the application started..."
docker logs whorang-test-enhanced 2>&1 | grep -i "starting\|listening\|ready\|nginx" || echo "No startup messages found"

echo ""
echo "Full container logs:"
docker logs whorang-test-enhanced

echo ""
echo "Stopping and removing test container..."
docker stop whorang-test-enhanced
docker rm whorang-test-enhanced

echo ""
echo "Cleaning up test directories..."
rm -rf /tmp/whorang-test
echo "Test completed."
