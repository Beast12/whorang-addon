# WhoRang v2.0.3 Release Notes

**Release Date**: January 22, 2025  
**Status**: ✅ **CRITICAL HOTFIX RELEASE**

## 🚨 Critical Issue Fixed

Version 2.0.3 is a **critical hotfix release** that resolves Home Assistant add-on permission issues that prevented v2.0.2 from starting properly in Home Assistant environments.

## 🔧 Critical Bug Fix

### **Home Assistant Add-on Permission Issues Resolved**
- **Issue**: v2.0.2 failed to start in Home Assistant add-on mode due to permission denied errors
- **Root Cause**: Home Assistant add-ons run with restricted permissions and cannot change ownership of system directories
- **Solution**: Implemented Home Assistant add-on specific configuration that uses writable directories
- **Result**: ✅ Container now starts successfully in both Home Assistant add-on and standalone Docker modes

## 🏗️ Technical Changes

### **Nginx Configuration Updates**
- **Changed nginx user** from `nginx` to `root` for Home Assistant add-on compatibility
- **Updated log locations** to use `/tmp` directory instead of `/var/log/nginx`
- **Updated PID file location** to `/tmp/nginx.pid` instead of `/run/nginx/nginx.pid`
- **Updated temp directories** to use `/tmp` based paths for Home Assistant add-on mode

### **Startup Script Enhancements**
- **Added deployment mode detection** - different behavior for HA add-on vs standalone Docker
- **Skip permission operations** in Home Assistant add-on mode where they're not permitted
- **Use writable temp directories** (`/tmp/nginx-*`) for nginx in HA add-on mode
- **Maintain system directories** for standalone Docker deployments
- **Enhanced error logging** to check both temp and system log locations

### **Directory Structure Changes**

#### **Home Assistant Add-on Mode**
```bash
# Nginx uses writable temp directories
/tmp/nginx.pid                 # PID file
/tmp/nginx-error.log          # Error log
/tmp/nginx-access.log         # Access log
/tmp/nginx-client-body/       # Client body temp
/tmp/nginx-proxy/             # Proxy temp
/tmp/nginx-fastcgi/           # FastCGI temp
/tmp/nginx-uwsgi/             # uWSGI temp
/tmp/nginx-scgi/              # SCGI temp
```

#### **Standalone Docker Mode**
```bash
# Nginx uses system directories (unchanged)
/run/nginx/nginx.pid          # PID file
/var/log/nginx/error.log      # Error log
/var/log/nginx/access.log     # Access log
/var/lib/nginx/tmp/           # Temp directories
/var/cache/nginx/             # Cache directories
```

## 🔄 Deployment Compatibility

### **Fixed Environments**
- ✅ **Home Assistant OS/Supervised** - Now works correctly
- ✅ **Home Assistant Container/Core** - Now works correctly
- ✅ **Standalone Docker deployment** - Continues to work as before
- ✅ **Multi-architecture support** - amd64, arm64, armv7

### **Backward Compatibility**
- ✅ **Existing standalone Docker deployments** continue to work unchanged
- ✅ **Configuration files** remain compatible
- ✅ **User-configured paths** continue to work as implemented in v2.0.2
- ✅ **All v2.0.2 features** are preserved and functional

## 🧪 Testing Completed

### **Home Assistant Add-on Validation**
- ✅ Container starts without permission errors
- ✅ Nginx starts successfully using temp directories
- ✅ No `chown`/`chmod` permission denied errors
- ✅ User-configured paths work correctly
- ✅ Integration files deploy properly

### **Standalone Docker Validation**
- ✅ Continues to work exactly as in v2.0.2
- ✅ System directories used with proper permissions
- ✅ All existing functionality preserved

## 🚀 Upgrade Instructions

### **Home Assistant Add-on Users (CRITICAL)**
**This update is REQUIRED for Home Assistant add-on users:**

1. **Update immediately** through the Home Assistant add-on store
2. **Restart the add-on** - it will now start successfully
3. **Verify operation** - check that the add-on starts without errors
4. **No configuration changes needed** - all settings are preserved

### **Standalone Docker Users**
**This update is OPTIONAL for standalone Docker users:**

```bash
# Pull the latest image
docker pull ghcr.io/beast12/whorang-backend:v2.0.3

# Update your deployment (no changes needed)
docker run -d \
  --name whorang-backend \
  -p 3001:3001 \
  -v ./whorang-data:/data \
  -e DATABASE_PATH="/data/whorang.db" \
  -e UPLOADS_PATH="/data/uploads" \
  ghcr.io/beast12/whorang-backend:v2.0.3
```

## ⚠️ Important Notes

### **For Home Assistant Users**
- **v2.0.2 will NOT work** in Home Assistant add-on mode
- **v2.0.3 is REQUIRED** for Home Assistant add-on users
- **Update immediately** to resolve startup failures

### **For Docker Users**
- **v2.0.3 is backward compatible** with v2.0.2
- **No breaking changes** for standalone Docker deployments
- **Optional update** but recommended for consistency

## 📊 What's Fixed

| Issue | v2.0.2 Status | v2.0.3 Status |
|-------|---------------|---------------|
| **HA Add-on Startup** | ❌ Failed | ✅ Works |
| **Permission Errors** | ❌ Multiple errors | ✅ No errors |
| **Nginx Start** | ❌ Failed in HA | ✅ Starts successfully |
| **Docker Standalone** | ✅ Worked | ✅ Still works |
| **User Paths** | ✅ Worked | ✅ Still works |

## 🔮 What's Next

This hotfix ensures WhoRang works reliably across all deployment scenarios. Future releases will focus on:

- Enhanced monitoring and analytics
- Advanced face recognition improvements
- Mobile app integration
- Cloud backup and synchronization

## 📞 Support

### **Immediate Help**
- **Home Assistant Add-on**: Update to v2.0.3 immediately
- **Docker Users**: Optional update, but recommended
- **Issues**: Report any problems on GitHub

### **Validation**
After updating, verify:
- ✅ Add-on starts without errors
- ✅ Web interface is accessible
- ✅ Face detection works correctly
- ✅ User-configured paths are respected

---

**WhoRang v2.0.3** resolves the critical Home Assistant add-on compatibility issue and ensures reliable operation across all supported deployment environments.

**Status**: ✅ **CRITICAL HOTFIX - IMMEDIATE UPDATE RECOMMENDED FOR HA USERS**
