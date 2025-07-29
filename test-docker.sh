#!/bin/bash

# Test script to verify Docker container with our changes

echo "=== WhoRang Docker Container Test ==="

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
  "log_level": "debug"
}
EOF
echo "Created mock Home Assistant options.json with custom paths:"
cat /tmp/whorang-test/data/options.json
echo ""

# Run the container with our test configuration
echo "Starting Docker container with test configuration..."

docker run -d \
  --name whorang-test \
  -v /tmp/whorang-test/data:/data \
  -v /tmp/whorang-test/config:/config \
  -e WHORANG_ADDON_MODE=true \
  -e DATABASE_PATH=/data/whorang-custom.db \
  -e UPLOADS_PATH=/data/uploads-custom \
  whorang-test

echo "Container started. Waiting for initialization..."
sleep 10

echo "Checking container logs for configuration loading..."
docker logs whorang-test 2>&1 | grep -A 20 "Configuration Summary"

echo ""
echo "Checking for any permission errors..."
docker logs whorang-test 2>&1 | grep -i "permission\|error\|EACCES" || echo "No permission errors found"

echo ""
echo "Checking if native modules are loading..."
docker logs whorang-test 2>&1 | grep -i "better-sqlite3\|sharp\|canvas" || echo "No native module loading messages found"

echo ""
echo "Checking if the application started..."
docker logs whorang-test 2>&1 | grep -i "starting\|listening\|ready" || echo "No startup messages found"

echo ""
echo "Stopping and removing test container..."
docker stop whorang-test
docker rm whorang-test

echo ""
echo "Cleaning up test directories..."
rm -rf /tmp/whorang-test
echo "Test completed."
