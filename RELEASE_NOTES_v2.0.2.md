# WhoRang v2.0.2 Release Notes

**Release Date**: January 22, 2025  
**Status**: ✅ **STABLE RELEASE**

## 🎯 Release Overview

Version 2.0.2 is a **critical bug fix release** that resolves nginx permission issues and implements comprehensive user-configured path support. This release ensures reliable startup and proper utilization of user settings from the Home Assistant add-on GUI.

## 🔧 Critical Bug Fixes

### **Nginx Permission Issues Resolved**
- ✅ **Fixed nginx startup failures** due to permission denied errors
- ✅ **Resolved directory creation issues** for `/var/lib/nginx/logs/error.log` and `/var/lib/nginx/tmp/client_body`
- ✅ **Implemented proper nginx directory structure** with correct ownership (nginx:nginx)
- ✅ **Added explicit temp directory paths** in nginx configuration

### **User-Configured Paths Implementation**
- ✅ **Fixed ignored GUI settings** - Application now uses exact paths configured in Home Assistant add-on
- ✅ **Database path respect** - Uses user-configured database path (e.g., `/homeassistant/whorang/whorang.db`)
- ✅ **Upload path respect** - Uses user-configured upload path (e.g., `/homeassistant/whorang/uploads`)
- ✅ **Directory auto-creation** - Creates user-specified directories if they don't exist

## ✨ New Features

### **Configuration System**
- 🆕 **Multi-source configuration reader** supporting Home Assistant options, environment variables, and defaults
- 🆕 **Configuration precedence hierarchy**: Environment Variables → HA Options → Defaults
- 🆕 **Comprehensive validation** with type checking and security validation
- 🆕 **Debug endpoints** for configuration troubleshooting (`/api/debug/config`, `/api/debug/directories`)

### **Path Management**
- 🆕 **Path validation utility** with security checks against path traversal attacks
- 🆕 **Automatic directory creation** with proper permissions
- 🆕 **Graceful fallback system** when user paths aren't accessible
- 🆕 **Write permission testing** before using configured paths

### **Enhanced Startup Process**
- 🆕 **Comprehensive startup validation** with detailed logging
- 🆕 **Home Assistant add-on detection** with automatic configuration loading
- 🆕 **Nginx validation** before startup to prevent runtime errors
- 🆕 **Path accessibility testing** with clear error reporting

## 🏗️ Technical Improvements

### **Docker & Nginx Enhancements**
- 🔧 **Enhanced Dockerfile** with comprehensive nginx directory creation
- 🔧 **Improved docker-entrypoint.sh** with robust error handling and validation
- 🔧 **Updated nginx.conf** with explicit temp directory paths
- 🔧 **Dynamic upload serving** with user-path fallback in backend.conf

### **Code Architecture**
- 🔧 **Modular configuration system** with clear separation of concerns
- 🔧 **Robust error handling** throughout the application
- 🔧 **Comprehensive logging** for debugging and monitoring
- 🔧 **Production-ready implementation** with extensive validation

## 📋 Files Added

### **New Utilities**
- `whorang/utils/configReader.js` - Multi-source configuration reader
- `whorang/utils/pathValidator.js` - Path validation and security utility
- `whorang/test_configuration.js` - Configuration testing and validation script
- `NGINX_PERMISSIONS_AND_USER_PATHS_SOLUTION.md` - Complete solution documentation

### **Files Modified**
- `whorang/Dockerfile` - Enhanced nginx directory creation and permissions
- `whorang/docker-entrypoint.sh` - Comprehensive startup script with validation
- `whorang/nginx.conf` - Explicit temp directory paths configuration
- `whorang/backend.conf` - Dynamic upload path serving with fallback
- `whorang/server.js` - Integration with new configuration system
- `whorang/utils/directoryManager.js` - User-configured path integration
- `whorang/utils/databaseManager.js` - User-configured database path support
- `whorang/config.yaml` - Version bump to 2.0.2

## 🔄 Deployment Compatibility

### **Supported Platforms**
- ✅ **Home Assistant OS** (Recommended)
- ✅ **Home Assistant Supervised** (Recommended)
- ✅ **Home Assistant Container**
- ✅ **Home Assistant Core**
- ✅ **Standalone Docker**

### **Architecture Support**
- ✅ **amd64** (Intel/AMD 64-bit)
- ✅ **arm64** (ARM 64-bit, Raspberry Pi 4, Apple M1)
- ✅ **armv7** (ARM 32-bit, Raspberry Pi 3)

## 🧪 Testing & Validation

### **Test Coverage**
- ✅ Configuration reader functionality
- ✅ Path validator operations
- ✅ Directory manager path resolution
- ✅ Database manager path resolution
- ✅ Environment variable detection
- ✅ File system access validation
- ✅ Home Assistant add-on detection

### **Validation Tools**
```bash
# Run comprehensive configuration test
node whorang/test_configuration.js

# Check configuration status
curl http://localhost:3001/api/debug/config

# Check directory and path status
curl http://localhost:3001/api/debug/directories
```

## 🚀 Upgrade Instructions

### **Home Assistant Add-on Users**
1. **Update the add-on** through the Home Assistant add-on store
2. **Configure your preferred paths** in the add-on configuration:
   - Database path: `/homeassistant/whorang/whorang.db`
   - Uploads path: `/homeassistant/whorang/uploads`
3. **Restart the add-on** - directories will be created automatically
4. **Verify operation** via the debug endpoints

### **Standalone Docker Users**
```bash
# Pull the latest image
docker pull ghcr.io/beast12/whorang-backend:v2.0.2

# Update your deployment with environment variables
docker run -d \
  --name whorang-backend \
  -p 3001:3001 \
  -v ./whorang-data:/data \
  -e DATABASE_PATH="/data/whorang.db" \
  -e UPLOADS_PATH="/data/uploads" \
  ghcr.io/beast12/whorang-backend:v2.0.2
```

## 🔍 Troubleshooting

### **Common Issues**

#### **Nginx Won't Start**
```bash
# Check nginx configuration
nginx -t

# Check directory permissions
ls -la /var/lib/nginx/ /var/log/nginx/

# Check error logs
cat /var/log/nginx/error.log
```

#### **User Paths Not Working**
```bash
# Check configuration status
curl http://localhost:3001/api/debug/config

# Run test script
node /app/test_configuration.js
```

#### **Permission Denied Errors**
```bash
# Check data directory permissions
ls -la /data/

# Test write permissions
touch /data/test_write && rm /data/test_write
```

## 📊 Performance Impact

### **Startup Time**
- **Improved startup reliability** with comprehensive validation
- **Faster error detection** with early validation checks
- **Reduced debugging time** with enhanced logging

### **Runtime Performance**
- **No performance impact** on existing functionality
- **Enhanced error handling** prevents runtime failures
- **Improved resource utilization** with proper directory management

## 🎉 Migration Notes

### **Automatic Migration**
- **No manual migration required** - all changes are backward compatible
- **Existing configurations preserved** - current settings will continue to work
- **Graceful fallback** - if user paths aren't accessible, system uses safe defaults

### **Configuration Benefits**
- **GUI settings now respected** - database and upload paths from add-on configuration are used
- **Enhanced reliability** - robust error handling prevents startup failures
- **Better debugging** - comprehensive logging and debug endpoints

## 🔮 What's Next

### **Upcoming Features**
- Enhanced monitoring and analytics dashboard
- Advanced face recognition improvements
- Mobile app integration
- Cloud backup and synchronization options

### **Continued Improvements**
- Performance optimizations
- Additional AI provider integrations
- Enhanced automation capabilities
- Community feature requests

---

## 📞 Support

### **Getting Help**
- **Documentation**: Check the comprehensive solution guide in `NGINX_PERMISSIONS_AND_USER_PATHS_SOLUTION.md`
- **Debug Tools**: Use the built-in debug endpoints for troubleshooting
- **Test Script**: Run `node whorang/test_configuration.js` for validation
- **GitHub Issues**: Report bugs and feature requests on the GitHub repository

### **Known Limitations**
- Single doorbell support (multi-doorbell planned for future release)
- Local storage only (cloud backup planned)
- Manual face labeling (auto-labeling in development)

---

**WhoRang v2.0.2** represents a significant improvement in reliability and user experience. The comprehensive fix for nginx permissions and implementation of user-configured paths ensures a smooth, professional-grade experience across all deployment scenarios.

**Status**: Ready for production deployment across all supported environments.
