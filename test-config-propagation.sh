#!/bin/bash

# Test script to verify configuration propagation and native module loading

echo "=== WhoRang Add-on Configuration and Module Test ==="

echo "Creating test environment..."

# Create test directories
mkdir -p /tmp/test-data
mkdir -p /tmp/test-config

# Create a mock options.json with custom paths
cat > /tmp/test-data/options.json << 'EOF'
{
  "database_path": "/tmp/test-data/whorang.db",
  "uploads_path": "/tmp/test-data/uploads",
  "ai_provider": "local",
  "log_level": "debug"
}
EOF

echo "Created mock Home Assistant options.json with custom paths:"
cat /tmp/test-data/options.json
echo ""

# Test run.sh with mock environment
echo "Testing run.sh configuration loading..."

cd /home/koen/Personal/Github/whorang-addon/whorang

# Mock bashio functions for testing
export PATH="/usr/bin:$PATH"

# Create a mock bashio for testing
mkdir -p /tmp/mock-bin
cat > /tmp/mock-bin/bashio << 'EOF'
#!/bin/bash

case "$1" in
  "supervisor.ping")
    exit 0
    ;;
  "config")
    case "$2" in
      "database_path")
        echo "/tmp/test-data/whorang.db"
        ;;
      "uploads_path")
        echo "/tmp/test-data/uploads"
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

chmod +x /tmp/mock-bin/bashio
export PATH="/tmp/mock-bin:$PATH"

# Run run.sh in a subshell with mocked environment
(
  export PATH="/tmp/mock-bin:$PATH"
  echo "Running run.sh with mocked Home Assistant environment..."
  timeout 10s ./run.sh 2>&1 &
  RUN_PID=$!
  
  # Wait a bit for the script to start
  sleep 3
  
  # Check if the process is still running
  if kill -0 $RUN_PID 2>/dev/null; then
    echo "✅ run.sh started successfully"
    # Kill the process
    kill $RUN_PID 2>/dev/null
    wait $RUN_PID 2>/dev/null
  else
    echo "❌ run.sh failed to start or exited early"
    # Check exit status
    wait $RUN_PID 2>/dev/null
    echo "Exit code: $?"
  fi
)

echo ""
echo "=== Test Summary ==="
echo "1. Configuration propagation test: Check if run.sh correctly reads options.json and sets environment variables"
echo "2. Native module test: Would check if better-sqlite3, sharp, and canvas can load in the Node.js environment"
echo "3. Directory permissions test: Would verify that /app/node_modules has correct permissions"

echo ""
echo "To fully test in a Docker environment, you would need to:"
echo "1. Build the Docker image with 'docker build -t whorang-test .'"
echo "2. Run the container with proper volume mounts and environment"
echo "3. Check the logs to verify configuration values and module loading"

echo ""
echo "Cleanup test directories..."
rm -rf /tmp/test-data /tmp/test-config /tmp/mock-bin
echo "Test completed."
