#!/bin/bash

# Test script to verify Docker image pull

IMAGE_NAME="ghcr.io/beast12/whorang-addon"
VERSION="2.0.14"

echo "🔍 Testing Docker image pull for WhoRang AI Doorbell"
echo "Image: $IMAGE_NAME:$VERSION"
echo ""

# Test 1: Check if image exists and is publicly accessible
echo "🧪 Test 1: Checking image manifest..."
if curl -s -f -I "https://ghcr.io/v2/beast12/whorang-addon/manifests/$VERSION" > /dev/null; then
  echo "✅ Image manifest found"
else
  echo "❌ Image manifest not found - image may not be public or tag may not exist"
  echo "   Check GitHub Actions build logs and image visibility settings"
fi
echo ""

# Test 2: Try to pull the image
echo "🧪 Test 2: Attempting to pull image..."
if docker pull "$IMAGE_NAME:$VERSION"; then
  echo "✅ Image pulled successfully"
  echo ""
  # Show image details
  echo "📋 Image details:"
  docker images "$IMAGE_NAME:$VERSION" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
  
  # Clean up
  docker rmi "$IMAGE_NAME:$VERSION" >/dev/null 2>&1
else
  echo "❌ Failed to pull image"
  echo "   This could be due to:"
  echo "   - Image not being built correctly"
  echo "   - Image not being public"
  echo "   - Tag not matching what was actually published"
  echo "   - Network connectivity issues"
fi
echo ""

# Test 3: Check available tags
echo "🧪 Test 3: Checking available tags..."
if response=$(curl -s "https://ghcr.io/v2/beast12/whorang-addon/tags/list"); then
  echo "Available tags:"
  echo "$response" | jq -r '.tags[]' 2>/dev/null || echo "$response"
else
  echo "❌ Failed to retrieve tags list"
fi
echo ""

echo "🏁 Testing complete"
