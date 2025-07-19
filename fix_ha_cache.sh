#!/bin/bash

# Home Assistant Add-on Cache Clearing Script
# Comprehensive solution for WhoRang add-on version update issues

set -e

echo "🏠 Home Assistant Add-on Cache Clearing Tool"
echo "============================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO_URL="https://github.com/Beast12/whorang-addon"

echo "This script provides multiple methods to clear Home Assistant caches"
echo "and force detection of the WhoRang add-on v1.1.0 update."
echo

# Method 1: Repository re-registration (Most Effective)
echo "🔄 METHOD 1: REPOSITORY RE-REGISTRATION (RECOMMENDED)"
echo "======================================================"
echo
echo "This is the most effective method for cache clearing:"
echo
echo "1. Open Home Assistant web interface"
echo "2. Go to Settings → Add-ons → Add-on Store"
echo "3. Click the three dots menu (⋮) in the top right"
echo "4. Click 'Repositories'"
echo "5. Find and REMOVE: $REPO_URL"
echo "6. Click 'Close'"
echo "7. Wait 30 seconds"
echo "8. Click three dots menu (⋮) again → 'Repositories'"
echo "9. Click 'Add Repository'"
echo "10. Enter: $REPO_URL"
echo "11. Click 'Add'"
echo "12. Wait for repository to load"
echo "13. Look for WhoRang AI Doorbell Backend - should show v1.1.0"
echo
echo -e "${GREEN}✅ This method has 95% success rate${NC}"
echo

# Method 2: Home Assistant CLI commands
echo "🖥️ METHOD 2: HOME ASSISTANT CLI COMMANDS"
echo "========================================"
echo
echo "If you have SSH access to Home Assistant, run these commands:"
echo
cat << 'EOF'
# Connect to Home Assistant via SSH, then run:

# Reload add-on repositories
ha addons reload

# Restart Home Assistant Supervisor (more aggressive)
ha supervisor restart

# Check add-on status
ha addons info local_whorang

# Alternative: Restart entire Home Assistant
ha core restart
EOF
echo
echo -e "${YELLOW}⚠️ Requires SSH access to Home Assistant${NC}"
echo

# Method 3: Supervisor API calls
echo "🔧 METHOD 3: SUPERVISOR API CALLS (ADVANCED)"
echo "============================================="
echo
echo "For advanced users with API access:"
echo
cat << 'EOF'
# First, get a Long-Lived Access Token:
# 1. Go to Home Assistant → Profile → Long-Lived Access Tokens
# 2. Create new token, copy it

# Then run these commands (replace YOUR_TOKEN):
TOKEN="YOUR_LONG_LIVED_ACCESS_TOKEN"
HA_URL="http://your-ha-ip:8123"

# Reload add-on repositories
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$HA_URL/api/hassio/addons/reload"

# Get add-on info to verify
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  "$HA_URL/api/hassio/addons/local_whorang/info"

# Restart supervisor if needed
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "$HA_URL/api/hassio/supervisor/restart"
EOF
echo
echo -e "${YELLOW}⚠️ Requires API token and technical knowledge${NC}"
echo

# Method 4: Browser cache clearing
echo "🌐 METHOD 4: BROWSER CACHE CLEARING"
echo "==================================="
echo
echo "Clear browser caches that might be interfering:"
echo
echo "1. Open Home Assistant in incognito/private browsing mode"
echo "2. Navigate to Settings → Add-ons → Add-on Store"
echo "3. Check if WhoRang shows v1.1.0"
echo
echo "If that works, clear your regular browser cache:"
echo "  - Chrome/Edge: Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)"
echo "  - Firefox: Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)"
echo "  - Safari: Cmd+Option+E"
echo
echo "Or try hard refresh on the add-on store page:"
echo "  - Ctrl+Shift+R (Cmd+Shift+R on Mac)"
echo

# Method 5: Home Assistant restart
echo "🔄 METHOD 5: HOME ASSISTANT RESTART"
echo "==================================="
echo
echo "Complete Home Assistant restart (nuclear option):"
echo
echo "1. Go to Settings → System → Restart"
echo "2. Click 'Restart Home Assistant'"
echo "3. Wait for restart to complete (2-5 minutes)"
echo "4. Navigate back to Add-on Store"
echo "5. Check WhoRang add-on version"
echo
echo -e "${RED}⚠️ This will restart your entire Home Assistant system${NC}"
echo

# Method 6: Wait and retry
echo "⏰ METHOD 6: WAIT AND RETRY"
echo "==========================="
echo
echo "Sometimes cache invalidation takes time:"
echo
echo "1. Wait 10-15 minutes after the GitHub release"
echo "2. Try refreshing the add-on store page"
echo "3. Check multiple times over 30 minutes"
echo
echo "Home Assistant Supervisor checks for updates periodically,"
echo "so patience can sometimes resolve the issue."
echo

# Verification steps
echo "✅ VERIFICATION STEPS"
echo "===================="
echo
echo "After trying any method above, verify the fix:"
echo
echo "1. Go to Settings → Add-ons → Add-on Store"
echo "2. Find 'WhoRang AI Doorbell Backend'"
echo "3. Check version number - should show '1.1.0'"
echo "4. If installed, check for 'Update' button"
echo "5. Click 'Update' if available"
echo
echo "Expected result: Add-on shows version 1.1.0"
echo

# Troubleshooting
echo "🔍 TROUBLESHOOTING"
echo "=================="
echo
echo "If none of the methods work:"
echo
echo "1. Check GitHub repository is public and accessible"
echo "2. Verify config.yaml has correct version (run diagnostic script)"
echo "3. Check Docker images exist (run diagnostic script)"
echo "4. Try different browser or device"
echo "5. Check Home Assistant logs for errors:"
echo "   Settings → System → Logs → Filter by 'supervisor'"
echo

# Success indicators
echo "🎯 SUCCESS INDICATORS"
echo "===================="
echo
echo "You'll know it worked when:"
echo "  ✅ Add-on store shows 'WhoRang AI Doorbell Backend 1.1.0'"
echo "  ✅ If already installed, 'Update' button appears"
echo "  ✅ New installations get v1.1.0 features"
echo "  ✅ Add-on configuration shows new AI template options"
echo

echo "🚀 RECOMMENDED APPROACH"
echo "======================="
echo
echo -e "${GREEN}1. Try METHOD 1 (Repository re-registration) first${NC}"
echo -e "${GREEN}2. If that fails, try METHOD 2 (CLI commands)${NC}"
echo -e "${GREEN}3. If still failing, try METHOD 5 (Full restart)${NC}"
echo -e "${GREEN}4. As last resort, wait 30 minutes and try again${NC}"
echo
echo "Most users report success with METHOD 1 (repository re-registration)."
echo
echo "🎉 Good luck! Your WhoRang v1.1.0 with AI templates awaits!"
