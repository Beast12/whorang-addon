#!/bin/bash

# Test script to verify Docker image pull

IMAGE_NAME="ghcr.io/beast12/whorang-addon"
VERSION="2.0.14"

echo "🔍 Testing Docker image pull for WhoRang AI Doorbell"
echo "Main Image: $IMAGE_NAME:$VERSION"
echo ""

# Test 1: Check if main image exists and is publicly accessible
echo "🧪 Test 1: Checking main image manifest..."
if curl -s -f -I "https://ghcr.io/v2/beast12/whorang-addon/manifests/$VERSION" > /dev/null; then
  echo "✅ Main image manifest found"
else
  echo "❌ Main image manifest not found - image may not be public or tag may not exist"
  echo "   Check GitHub Actions build logs and image visibility settings"
fi
echo ""

# Test 2: Check architecture-specific images
echo "🧪 Test 2: Checking architecture-specific image manifests..."
ARCHITECTURES=("amd64" "arm64" "arm/v7")
for arch in "${ARCHITECTURES[@]}"; do
  echo "  Checking $arch..."
  # URL encode the arch for the API call
  encoded_arch=$(echo "$arch" | sed 's/\//%2F/g')
  if curl -s -f -I "https://ghcr.io/v2/beast12/whorang-addon/$encoded_arch/manifests/$VERSION" > /dev/null; then
    echo "    ✅ $arch manifest found"
  else
    echo "    ❌ $arch manifest not found"
    echo "       URL: https://ghcr.io/v2/beast12/whorang-addon/$encoded_arch/manifests/$VERSION"
  fi
done
echo ""

# Test 3: Try to pull the main image
echo "🧪 Test 3: Attempting to pull main image..."
if docker pull "$IMAGE_NAME:$VERSION"; then
  echo "✅ Main image pulled successfully"
  echo ""
  # Show image details
  echo "📋 Image details:"
  docker images "$IMAGE_NAME:$VERSION" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
  
  # Clean up
  docker rmi "$IMAGE_NAME:$VERSION" >/dev/null 2>&1
else
  echo "❌ Failed to pull main image"
  echo "   This could be due to:"
  echo "   - Image not being built correctly"
  echo "   - Image not being public"
  echo "   - Tag not matching what was actually published"
  echo "   - Network connectivity issues"
fi
echo ""

# Test 4: Try to pull architecture-specific image (like HA does)
echo "🧪 Test 4: Attempting to pull architecture-specific image (amd64)..."
ARCH_IMAGE_NAME="ghcr.io/beast12/whorang-addon/amd64"
if docker pull "$ARCH_IMAGE_NAME:$VERSION"; then
  echo "✅ Architecture-specific image pulled successfully"
  # Clean up
  docker rmi "$ARCH_IMAGE_NAME:$VERSION" >/dev/null 2>&1
else
  echo "❌ Failed to pull architecture-specific image"
  echo "   This is likely the cause of the Home Assistant installation error"
  echo "   URL: $ARCH_IMAGE_NAME:$VERSION"
fi
echo ""

# Test 5: Check available tags
echo "🧪 Test 5: Checking available tags..."
if response=$(curl -s "https://ghcr.io/v2/beast12/whorang-addon/tags/list"); then
  echo "Available tags:"
  echo "$response" | jq -r '.tags[]' 2>/dev/null || echo "$response"
else
  echo "❌ Failed to retrieve tags list"
fi
echo ""

echo "🏁 Testing complete"
