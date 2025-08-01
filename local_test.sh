#!/bin/bash

set -e

IMAGE_NAME="local/whorang-addon:latest"
CONTAINER_NAME="whorang-test-standalone"

# Clean up previous runs
echo "🧹 Cleaning up previous test runs..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
sudo rm -rf /tmp/whorang-standalone-data

# 1. Build the Docker image locally
echo "🏗️ Building local Docker image..."
docker build \
  --build-arg BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.20 \
  -t "$IMAGE_NAME" \
  -f ./whorang/Dockerfile ./whorang

# 2. Run the test, mimicking the CI job
echo "🔧 Testing standalone mode..."

# Prepare writable data directory
mkdir -p /tmp/whorang-standalone-data

# Run the container
docker run -d --name "$CONTAINER_NAME" \
  -p 8089:80 \
  -v /tmp/whorang-standalone-data:/data:rw \
  -e WHORANG_ADDON_MODE=false \
  -e AI_PROVIDER=local \
  -e LOG_LEVEL=info \
  "$IMAGE_NAME"

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 15

# 3. Perform health check
echo "🔍 Testing health endpoint..."
if curl -f http://localhost:8089/api/health; then
  echo "✅ Health check passed (standalone mode)"
else
  echo "❌ Health check failed (standalone mode)"
  echo "📋 Container logs:"
  docker logs "$CONTAINER_NAME"
  exit 1
fi

# Clean up
echo "🧹 Cleaning up..."
docker rm -f "$CONTAINER_NAME"
