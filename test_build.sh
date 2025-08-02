#!/bin/bash
set -e

# This script builds the Docker image locally with verbose output
# and checks for the existence of the critical native module binary.

IMAGE_NAME="whorang-addon-local-test"

echo "Building Docker image: $IMAGE_NAME..."

# Build the image with --progress=plain to see detailed output from RUN commands
# Pass the BUILD_ARCH variable, defaulting to amd64 for local testing.
BUILD_ARCH=${1:-amd64}

# Use the correct base image for the specified architecture
BUILD_FROM="ghcr.io/home-assistant/${BUILD_ARCH}-base:latest"

docker build \
  --build-arg BUILD_FROM=$BUILD_FROM \
  --build-arg BUILD_ARCH=$BUILD_ARCH \
  --progress=plain \
  -t $IMAGE_NAME \
  ./whorang

echo "Build complete."

echo "Checking for better_sqlite3.node file in the built image..."

# Run the container and execute a find command to locate the .node file
# If the file exists, it will print the path. If not, it will be silent.
FOUND_PATH=$(docker run --rm --entrypoint="" $IMAGE_NAME find /app -name "better_sqlite3.node")

if [ -n "$FOUND_PATH" ]; then
  echo "✅ SUCCESS: Found native module at: $FOUND_PATH"
else
  echo "❌ FAILURE: Could not find better_sqlite3.node in /app/node_modules."
  exit 1
fi
