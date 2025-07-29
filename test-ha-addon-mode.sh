#!/bin/bash

# Test script to verify Home Assistant add-on mode detection and configuration propagation

echo "=== WhoRang Add-on Mode Test ==="

# Create test environment
echo "Setting up test environment..."
mkdir -p /tmp/whorang-test/data
cd /tmp/whorang-test

# Create a mock options.json file (simulating HA add-on environment)
cat > /tmp/whorang-test/data/options.json << 'EOF'
{
  "ai_provider": "local",
  "log_level": "debug",
  "database_path": "/data/whorang.db",
  "uploads_path": "/data/uploads",
  "max_upload_size": "15MB",
  "face_recognition_threshold": 0.7,
  "ai_analysis_timeout": 45,
  "websocket_enabled": true,
  "cors_enabled": true,
  "cors_origins": ["http://localhost:8123", "https://myhome.duckdns.org"],
  "public_url": "https://myhome.duckdns.org/api/whorang"
}
EOF

echo "Created mock options.json with custom configuration values"

echo "\n=== Testing run.sh add-on mode detection ==="

# Copy the run.sh script to test directory
cp /home/koen/Personal/Github/whorang-addon/whorang/run.sh /tmp/whorang-test/

# Make it executable
chmod +x /tmp/whorang-test/run.sh

# Run the script in simulated HA add-on environment
export PATH="/usr/bin:$PATH"
echo "Running run.sh in simulated HA add-on environment..."
/tmp/whorang-test/run.sh
echo "Exit code: $?"

echo "\n=== Verifying environment variables ==="

# Check if environment variables were set correctly
echo "WHORANG_ADDON_MODE: ${WHORANG_ADDON_MODE:-NOT SET}"
echo "AI_PROVIDER: ${AI_PROVIDER:-NOT SET}"
echo "LOG_LEVEL: ${LOG_LEVEL:-NOT SET}"
echo "DATABASE_PATH: ${DATABASE_PATH:-NOT SET}"
echo "UPLOADS_PATH: ${UPLOADS_PATH:-NOT SET}"
echo "MAX_UPLOAD_SIZE: ${MAX_UPLOAD_SIZE:-NOT SET}"
echo "FACE_RECOGNITION_THRESHOLD: ${FACE_RECOGNITION_THRESHOLD:-NOT SET}"
echo "AI_ANALYSIS_TIMEOUT: ${AI_ANALYSIS_TIMEOUT:-NOT SET}"
echo "WEBSOCKET_ENABLED: ${WEBSOCKET_ENABLED:-NOT SET}"
echo "CORS_ENABLED: ${CORS_ENABLED:-NOT SET}"
echo "CORS_ORIGINS: ${CORS_ORIGINS:-NOT SET}"
echo "PUBLIC_URL: ${PUBLIC_URL:-NOT SET}"

echo "\n=== Testing docker-entrypoint.sh ==="

# Copy the docker-entrypoint.sh script to test directory
cp /home/koen/Personal/Github/whorang-addon/whorang/docker-entrypoint.sh /tmp/whorang-test/

# Make it executable
chmod +x /tmp/whorang-test/docker-entrypoint.sh

# Create a mock app directory structure
mkdir -p /tmp/whorang-test/app/uploads/faces \
         /tmp/whorang-test/app/uploads/temp \
         /tmp/whorang-test/app/uploads/thumbnails \
         /tmp/whorang-test/app/data \
         /tmp/whorang-test/app/node_modules

# Create a simple test server.js file
cat > /tmp/whorang-test/app/server.js << 'EOF'
console.log("=== WhoRang Test Server Started ===");
console.log("WHORANG_ADDON_MODE:", process.env.WHORANG_ADDON_MODE || "NOT SET");
console.log("AI_PROVIDER:", process.env.AI_PROVIDER || "NOT SET");
console.log("LOG_LEVEL:", process.env.LOG_LEVEL || "NOT SET");
console.log("DATABASE_PATH:", process.env.DATABASE_PATH || "NOT SET");
console.log("UPLOADS_PATH:", process.env.UPLOADS_PATH || "NOT SET");
console.log("MAX_UPLOAD_SIZE:", process.env.MAX_UPLOAD_SIZE || "NOT SET");
console.log("FACE_RECOGNITION_THRESHOLD:", process.env.FACE_RECOGNITION_THRESHOLD || "NOT SET");
console.log("AI_ANALYSIS_TIMEOUT:", process.env.AI_ANALYSIS_TIMEOUT || "NOT SET");
console.log("WEBSOCKET_ENABLED:", process.env.WEBSOCKET_ENABLED || "NOT SET");
console.log("CORS_ENABLED:", process.env.CORS_ENABLED || "NOT SET");
console.log("CORS_ORIGINS:", process.env.CORS_ORIGINS || "NOT SET");
console.log("PUBLIC_URL:", process.env.PUBLIC_URL || "NOT SET");

// Try to load native modules
try {
  console.log("Attempting to load better-sqlite3...");
  const sqlite3 = require('better-sqlite3');
  console.log("✓ better-sqlite3 loaded successfully");
} catch (err) {
  console.log("✗ Failed to load better-sqlite3:", err.message);
}

try {
  console.log("Attempting to load canvas...");
  const canvas = require('canvas');
  console.log("✓ canvas loaded successfully");
} catch (err) {
  console.log("✗ Failed to load canvas:", err.message);
}

try {
  console.log("Attempting to load sharp...");
  const sharp = require('sharp');
  console.log("✓ sharp loaded successfully");
} catch (err) {
  console.log("✗ Failed to load sharp:", err.message);
}

console.log("=== Test Complete ===");
process.exit(0);
EOF

# Create a simple test for native modules
mkdir -p /tmp/whorang-test/app/node_modules/better-sqlite3/build/Release
echo "mock native module" > /tmp/whorang-test/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node

mkdir -p /tmp/whorang-test/app/node_modules/canvas/build/Release
echo "mock native module" > /tmp/whorang-test/app/node_modules/canvas/build/Release/canvas.node

mkdir -p /tmp/whorang-test/app/node_modules/sharp/build/Release
echo "mock native module" > /tmp/whorang-test/app/node_modules/sharp/build/Release/sharp.node

# Set proper permissions for testing
chmod -R 755 /tmp/whorang-test/app
find /tmp/whorang-test/app/node_modules -name "*.node" -exec chmod 755 {} \;

# Run the docker-entrypoint.sh script in simulated HA add-on environment
echo "Running docker-entrypoint.sh in simulated HA add-on environment..."
cd /tmp/whorang-test
/tmp/whorang-test/docker-entrypoint.sh

echo "\n=== Cleanup ==="
echo "Cleaning up test environment..."
cd /
rm -rf /tmp/whorang-test

echo "\n=== Test Complete ==="
echo "If you see environment variables with values from options.json and no permission errors, the fix is working correctly."
