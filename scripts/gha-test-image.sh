#!/usr/bin/env bash
set -euo pipefail

# Local reproduction of the GitHub Actions test-image job from .github/workflows/docker-build.yml
# Usage:
#   scripts/gha-test-image.sh [--image ghcr.io/beast12/whorang-addon:latest]
#                             [--only standalone|addon|both]
#                             [--no-pull]
#                             [--inspect]
# Defaults:
#   --image defaults to ghcr.io/beast12/whorang-addon:latest
#   --only defaults to both
#   pulls image by default (omit with --no-pull)

REGISTRY="ghcr.io"
IMAGE_NAME="beast12/whorang-addon"
IMAGE_TAG="latest"
ONLY="both"
PULL=true
INSPECT=false

while [[ ${1:-} ]]; do
  case "$1" in
    --image)
      shift; IMG_IN=${1:?missing image};
      # Allow full ref or just tag
      if [[ "$IMG_IN" == ghcr.io/* ]]; then
        FULL_IMAGE="$IMG_IN"
      else
        IMAGE_TAG="$IMG_IN"
      fi
      ;;
    --only)
      shift; ONLY=${1:?missing value};;
    --no-pull)
      PULL=false;;
    --inspect)
      INSPECT=true;;
    *)
      echo "Unknown arg: $1" >&2; exit 2;;
  esac
  shift || true
done

if [[ -z ${FULL_IMAGE:-} ]]; then
  FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
fi

echo "🧪 Testing Home Assistant Add-on image: $FULL_IMAGE"

# Match GHA job: pull latest (or chosen tag)
if $PULL; then
  echo "== Pulling $FULL_IMAGE =="
  docker pull "$FULL_IMAGE"
fi

# Optional: Inspect image init scripts to confirm expected content
if $INSPECT; then
  echo "== Inspecting image init scripts (no-run) =="
  CID=$(docker create "$FULL_IMAGE" sh -c 'sleep 30')
  if [[ -n "$CID" ]]; then
    trap 'docker rm -f "$CID" >/dev/null 2>&1 || true' EXIT
    docker cp "$CID":/etc/cont-init.d /tmp/whorang-cont-init 2>/dev/null || true
    echo "-- /etc/cont-init.d listing --"; ls -la /tmp/whorang-cont-init || true
    if [[ -f /tmp/whorang-cont-init/02-nginx-init ]]; then
      echo "-- head 02-nginx-init --"; sed -n '1,200p' /tmp/whorang-cont-init/02-nginx-init || true
      echo "-- mode 02-nginx-init --"; (stat -c '%A %a %n' /tmp/whorang-cont-init/02-nginx-init 2>/dev/null || ls -l /tmp/whorang-cont-init/02-nginx-init) || true
    else
      echo "02-nginx-init not found; available files:"; ls -la /tmp/whorang-cont-init || true
    fi
    docker rm -f "$CID" >/dev/null 2>&1 || true
    trap - EXIT
  fi
fi

# Prepare writable data directories (exactly as workflow)
rm -rf /tmp/whorang-standalone-data /tmp/whorang-addon-data || true
mkdir -p /tmp/whorang-standalone-data /tmp/whorang-addon-data
chmod 755 /tmp/whorang-standalone-data /tmp/whorang-addon-data

echo '{"ai_provider": "local", "log_level": "info", "database_path": "/data/whorang.db", "uploads_path": "/data/uploads"}' > /tmp/whorang-addon-data/options.json
# chown may fail on some systems; ignore like workflow tolerance
sudo chown -R nobody:nogroup /tmp/whorang-addon-data 2>/dev/null || true

run_standalone() {
  echo "\n🔧 Testing standalone mode..."
  docker rm -f whorang-test-standalone >/dev/null 2>&1 || true
  docker run -d --name whorang-test-standalone \
    -p 8080:8080 \
    -v /tmp/whorang-standalone-data:/data:rw \
    -e WHORANG_ADDON_MODE=false \
    -e AI_PROVIDER=local \
    -e LOG_LEVEL=info \
    "$FULL_IMAGE"
  echo "⏳ Waiting for services to start..."
  sleep 10
  echo "🔍 Testing health endpoint..."
  if docker exec whorang-test-standalone curl -f http://localhost:8080/health; then
    echo "✅ Health check passed (standalone mode)"
  else
    echo "❌ Health check failed (standalone mode)"
    echo "📋 Container logs:"
    docker logs whorang-test-standalone
    return 1
  fi
  echo "🔍 Testing database connection..."
  if docker exec whorang-test-standalone curl -f http://localhost:8080/api/stats; then
    echo "✅ Database connection working"
  else
    echo "❌ Database connection failed"
    echo "📋 Container logs:"
    docker logs whorang-test-standalone
    return 1
  fi
  echo "🔍 Testing web interface with retries..."
  local max_attempts=5
  local attempt=1
  while [ $attempt -le $max_attempts ]; do
    echo "  Attempt $attempt/$max_attempts..."
    if docker exec whorang-test-standalone curl -f -s http://localhost:8080/ | grep -q "WhoRang"; then
      echo "✅ Web interface working - contains WhoRang text!"
      break
    fi
    echo "  ⏳ Waiting 10 seconds before retry..."; sleep 10
    attempt=$((attempt + 1))
  done
  if [ $attempt -gt $max_attempts ]; then
    echo "❌ Web interface test failed after $max_attempts attempts"
    echo "📋 Response details:"; docker exec whorang-test-standalone curl -v http://localhost:8080/ || true
    echo "📋 Container logs:"; docker logs whorang-test-standalone
    return 1
  fi
  docker stop whorang-test-standalone >/dev/null 2>&1 || true
  docker rm whorang-test-standalone >/dev/null 2>&1 || true
}

run_addon() {
  echo "\n🏠 Testing Home Assistant add-on mode simulation..."
  docker rm -f whorang-test-addon >/dev/null 2>&1 || true
  docker run -d --name whorang-test-addon \
    -p 8081:8080 \
    -e HASSIO_TOKEN=dummy-token \
    -e HASSIO_ADDON=http://127.0.0.1 \
    -e WHORANG_ADDON_MODE=true \
    -e AI_PROVIDER=local \
    -e LOG_LEVEL=info \
    -v /tmp/whorang-addon-data:/data:rw \
    "$FULL_IMAGE"
  echo "⏳ Waiting for services to start..."; sleep 20
  if ! docker logs whorang-test-addon | grep -q "Home Assistant Add-on mode detected"; then
    echo "❌ HA mode detection failed"; docker logs whorang-test-addon; return 1
  fi
  echo "✅ HA mode detection working"
  if ! docker logs whorang-test-addon | grep -q "Home Assistant options found"; then
    echo "❌ Configuration loading failed"; docker logs whorang-test-addon; return 1
  fi
  echo "✅ Loaded Home Assistant add-on options"
  if ! docker logs whorang-test-addon | grep -q "Database schema initialized"; then
    echo "❌ Database initialization failed"; docker logs whorang-test-addon; return 1
  fi
  echo "✅ Database initialization working"
  if ! docker logs whorang-test-addon | grep -q "WhoRang - AI-Powered Doorbell Intelligence"; then
    echo "❌ Server did not start correctly"; docker logs whorang-test-addon; return 1
  fi
  echo "✅ Server start message present"
  echo "🔍 Testing HA add-on health endpoint..."; sleep 5
  if docker exec whorang-test-addon curl -f -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ HA add-on health endpoint working"
  else
    echo "❌ HA add-on health endpoint failed"; docker logs whorang-test-addon; return 1
  fi
  echo "🧹 Cleaning up HA add-on test..."
  docker stop whorang-test-addon >/dev/null 2>&1 || true
  docker rm whorang-test-addon >/dev/null 2>&1 || true
}

status=0
case "$ONLY" in
  standalone)
    run_standalone || status=$? ;;
  addon)
    run_addon || status=$? ;;
  both)
    run_standalone || status=$?
    if [[ $status -eq 0 ]]; then
      run_addon || status=$?
    fi
    ;;
  *) echo "Invalid --only value: $ONLY"; exit 2;;

esac

exit $status
