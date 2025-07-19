#!/bin/bash

# WhoRang Add-on Version Debug Script
# DevOps diagnostic tool for Home Assistant add-on version issues

set -e

echo "🔍 WhoRang Add-on Version Diagnostic Tool"
echo "========================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/Beast12/whorang-addon"
DOCKER_IMAGE="ghcr.io/beast12/whorang-backend"
EXPECTED_VERSION="1.1.0"

echo "📋 CONFIGURATION"
echo "Repository: $REPO_URL"
echo "Docker Image: $DOCKER_IMAGE"
echo "Expected Version: $EXPECTED_VERSION"
echo

# Function to check status
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
    fi
}

# 1. Check local repository status
echo "🔧 1. LOCAL REPOSITORY STATUS"
echo "-----------------------------"

echo -n "Current branch: "
git branch --show-current
echo -n "Latest commit: "
git log --oneline -1
echo -n "Tags: "
git tag --list | grep -E "v?1\.[0-9]+\.[0-9]+" | tail -3
echo

# 2. Check config.yaml version
echo "📄 2. CONFIG.YAML VERIFICATION"
echo "------------------------------"

if [ -f "whorang/config.yaml" ]; then
    echo -n "Config file exists: "
    echo -e "${GREEN}✅ YES${NC}"
    
    echo -n "Version in config: "
    VERSION=$(grep "^version:" whorang/config.yaml | sed 's/version: *"\?\([^"]*\)"\?/\1/')
    echo "$VERSION"
    
    if [ "$VERSION" = "$EXPECTED_VERSION" ]; then
        echo -e "Version match: ${GREEN}✅ CORRECT${NC}"
    else
        echo -e "Version match: ${RED}❌ MISMATCH${NC} (expected: $EXPECTED_VERSION)"
    fi
else
    echo -e "Config file: ${RED}❌ NOT FOUND${NC}"
fi
echo

# 3. Check repository.yaml
echo "📦 3. REPOSITORY.YAML VERIFICATION"
echo "----------------------------------"

if [ -f "repository.yaml" ]; then
    echo -n "Repository config exists: "
    echo -e "${GREEN}✅ YES${NC}"
    
    echo "Repository configuration:"
    cat repository.yaml | sed 's/^/  /'
else
    echo -e "Repository config: ${RED}❌ NOT FOUND${NC}"
fi
echo

# 4. Check GitHub repository accessibility
echo "🌐 4. GITHUB REPOSITORY ACCESS"
echo "------------------------------"

echo -n "Repository accessibility: "
if curl -s -o /dev/null -w "%{http_code}" "$REPO_URL" | grep -q "200"; then
    echo -e "${GREEN}✅ ACCESSIBLE${NC}"
else
    echo -e "${RED}❌ NOT ACCESSIBLE${NC}"
fi

echo -n "Raw config.yaml access: "
RAW_CONFIG_URL="https://raw.githubusercontent.com/Beast12/whorang-addon/main/whorang/config.yaml"
if curl -s "$RAW_CONFIG_URL" | grep -q "version.*$EXPECTED_VERSION"; then
    echo -e "${GREEN}✅ VERSION CORRECT${NC}"
else
    echo -e "${RED}❌ VERSION INCORRECT${NC}"
    echo "  Raw version found:"
    curl -s "$RAW_CONFIG_URL" | grep "version:" | sed 's/^/    /'
fi
echo

# 5. Check Docker images
echo "🐳 5. DOCKER IMAGE VERIFICATION"
echo "-------------------------------"

echo "Checking Docker image tags..."

# Check if docker is available
if command -v docker &> /dev/null; then
    echo -n "Docker available: "
    echo -e "${GREEN}✅ YES${NC}"
    
    # Check specific version tag
    echo -n "Image v$EXPECTED_VERSION exists: "
    if docker manifest inspect "$DOCKER_IMAGE:v$EXPECTED_VERSION" &> /dev/null; then
        echo -e "${GREEN}✅ EXISTS${NC}"
    else
        echo -e "${RED}❌ NOT FOUND${NC}"
    fi
    
    echo -n "Image $EXPECTED_VERSION exists: "
    if docker manifest inspect "$DOCKER_IMAGE:$EXPECTED_VERSION" &> /dev/null; then
        echo -e "${GREEN}✅ EXISTS${NC}"
    else
        echo -e "${RED}❌ NOT FOUND${NC}"
    fi
    
    echo -n "Image latest exists: "
    if docker manifest inspect "$DOCKER_IMAGE:latest" &> /dev/null; then
        echo -e "${GREEN}✅ EXISTS${NC}"
    else
        echo -e "${RED}❌ NOT FOUND${NC}"
    fi
else
    echo -e "Docker: ${YELLOW}⚠️ NOT AVAILABLE${NC}"
fi
echo

# 6. Check GitHub releases
echo "🏷️ 6. GITHUB RELEASES"
echo "--------------------"

echo -n "GitHub API accessibility: "
if curl -s "https://api.github.com/repos/Beast12/whorang-addon/releases" | grep -q "tag_name"; then
    echo -e "${GREEN}✅ ACCESSIBLE${NC}"
    
    echo "Recent releases:"
    curl -s "https://api.github.com/repos/Beast12/whorang-addon/releases" | \
        jq -r '.[] | select(.tag_name | test("v?[0-9]+\\.[0-9]+\\.[0-9]+")) | "  " + .tag_name + " (" + .published_at + ")"' | \
        head -5 2>/dev/null || \
        curl -s "https://api.github.com/repos/Beast12/whorang-addon/releases" | \
        grep -o '"tag_name":"[^"]*"' | head -5 | sed 's/"tag_name":"\([^"]*\)"/  \1/'
else
    echo -e "${RED}❌ NOT ACCESSIBLE${NC}"
fi
echo

# 7. Generate Home Assistant commands
echo "🏠 7. HOME ASSISTANT CACHE CLEARING COMMANDS"
echo "--------------------------------------------"

cat << 'EOF'
Execute these commands in Home Assistant to clear caches:

## Method 1: Home Assistant CLI (if available)
ha addons reload
ha supervisor restart

## Method 2: Home Assistant Core restart
# Go to Settings → System → Restart → Restart Home Assistant

## Method 3: Supervisor API calls (Advanced)
# SSH into Home Assistant and run:
curl -X POST \
  -H "Authorization: Bearer YOUR_LONG_LIVED_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  http://supervisor/addons/reload

## Method 4: Remove and re-add repository
# 1. Go to Settings → Add-ons → Add-on Store
# 2. Click three dots → Repositories
# 3. Remove: https://github.com/Beast12/whorang-addon
# 4. Wait 30 seconds
# 5. Re-add: https://github.com/Beast12/whorang-addon
# 6. Refresh page

## Method 5: Browser cache clearing
# 1. Open Home Assistant in incognito/private mode
# 2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
# 3. Clear browser cache completely

EOF

# 8. Generate verification URLs
echo "🔗 8. VERIFICATION URLS"
echo "----------------------"

echo "Manual verification URLs:"
echo "  Repository: $REPO_URL"
echo "  Raw config: https://raw.githubusercontent.com/Beast12/whorang-addon/main/whorang/config.yaml"
echo "  Releases: $REPO_URL/releases"
echo "  Docker Hub: https://github.com/Beast12/whorang-addon/pkgs/container/whorang-backend"
echo

# 9. Summary and recommendations
echo "📊 9. SUMMARY AND RECOMMENDATIONS"
echo "---------------------------------"

echo "Based on the diagnostic results above:"
echo
echo "If config.yaml shows correct version but HA shows old version:"
echo "  → This is a Home Assistant Supervisor caching issue"
echo "  → Try the cache clearing methods in section 7"
echo
echo "If Docker images are missing:"
echo "  → Check GitHub Actions workflow completion"
echo "  → Verify CI/CD pipeline ran successfully"
echo
echo "If repository is not accessible:"
echo "  → Check GitHub repository permissions"
echo "  → Verify repository is public"
echo
echo "Next steps:"
echo "  1. Try cache clearing methods (section 7)"
echo "  2. Wait 5-10 minutes for propagation"
echo "  3. Check HA add-on store again"
echo "  4. If still failing, try repository re-registration"

echo
echo "🎯 Diagnostic complete!"
echo "If issues persist, check the generated solutions below."
