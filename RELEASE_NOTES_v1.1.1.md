# WhoRang AI Doorbell Backend v1.1.1 Release Notes

**Release Date:** January 19, 2025  
**Version:** 1.1.1  
**Type:** Bug Fix Release

## 🐛 Critical Bug Fixes

### Fixed Home Assistant Addon Permission Issues

**Problem:** The addon was failing to start due to `EACCES` permission denied errors when trying to create upload directories in `/data/uploads/faces`. This prevented the addon from functioning in many Home Assistant environments.

**Solution:** Implemented a comprehensive 3-level fallback system for directory creation and file uploads.

## 🔧 Technical Improvements

### 1. New DirectoryManager Utility
- **File:** `whorang/utils/directoryManager.js`
- **Purpose:** Centralized directory management with robust fallback support
- **Features:**
  - 3-level fallback system: `/data/uploads` → `/app/uploads` → `./uploads`
  - Write permission testing and validation
  - Caching for improved performance
  - Comprehensive logging for debugging

### 2. Enhanced Docker Entrypoint
- **File:** `whorang/docker-entrypoint.sh`
- **Improvements:**
  - Creates both `/data/uploads/*` and `/app/uploads/*` directories
  - Tests write permissions before starting the application
  - Sets `DATA_UPLOADS_WRITABLE` environment variable
  - Provides clear logging for permission debugging

### 3. Robust Upload Middleware
- **File:** `whorang/middleware/upload.js`
- **Enhancements:**
  - Complete rewrite using DirectoryManager
  - Multiple fallback levels for directory creation
  - Enhanced error handling and logging
  - File size limits and type validation
  - Status reporting for debugging

### 4. Updated Upload Path Management
- **File:** `whorang/utils/uploadPaths.js`
- **Changes:**
  - Integrated with DirectoryManager
  - Maintains backward compatibility
  - Automatic fallback support for all path operations

### 5. Face Cropping Services Updates
- **Files:** All face cropping services updated
  - `whorang/services/faceCroppingService.js`
  - `whorang/services/faceCroppingServiceLite.js`
  - `whorang/services/faceCroppingServiceSharp.js`
- **Improvements:**
  - Integrated DirectoryManager for consistent directory handling
  - Enhanced error handling and logging
  - Fallback path support for all operations

### 6. Dockerfile Enhancements
- **File:** `whorang/Dockerfile`
- **Changes:**
  - Pre-creates `/data/uploads` directory structure
  - Attempts to set proper ownership with graceful failure handling
  - Ensures fallback directories always exist

### 7. Server Enhancements
- **File:** `whorang/server.js`
- **New Feature:** Added `/api/debug/directories` endpoint for real-time directory status monitoring

## 🧪 Testing & Debugging Tools

### New Test Script
- **File:** `whorang/test_directory_permissions.js`
- **Purpose:** Comprehensive testing of directory permissions and upload functionality
- **Features:**
  - Tests DirectoryManager functionality
  - Validates directory creation and write permissions
  - Checks upload middleware status
  - Verifies face cropping service initialization

### Debug Endpoint
- **Endpoint:** `GET /api/debug/directories`
- **Returns:**
  - DirectoryManager status
  - Upload middleware configuration
  - Environment variables
  - Current directory paths and permissions

## 📚 Documentation

### New Documentation
- **File:** `whorang/PERMISSION_FIXES_README.md`
- **Content:** Complete implementation guide and troubleshooting documentation

## 🏠 Home Assistant Integration

### Compatibility
- Works with various Home Assistant configurations
- Handles restricted permission environments gracefully
- Maintains data persistence when possible
- Falls back to temporary storage when needed

### Storage Strategy
- **Primary:** `/data/uploads` - Persistent across addon restarts
- **Fallback:** `/app/uploads` - Container storage
- **Last Resort:** `./uploads` - Relative path storage

## 🔍 Troubleshooting

### Log Monitoring
Look for these indicators in the logs:

**Success:**
```
✅ /data/uploads is writable
✅ Upload middleware initialized
✅ Face cropping service initialized
```

**Fallback Mode:**
```
⚠️ /data/uploads is not writable, will use /app/uploads as fallback
✅ Fallback directory ensured
```

**Debug Information:**
- Use the test script: `node test_directory_permissions.js`
- Check debug endpoint: `/api/debug/directories`

## 🎯 Benefits

1. **Reliability:** Multiple fallback levels ensure the addon always starts
2. **Transparency:** Clear logging shows exactly what's happening
3. **Debugging:** Comprehensive status reporting and test tools
4. **Compatibility:** Works in various Home Assistant configurations
5. **Performance:** Caching avoids repeated directory operations
6. **Maintainability:** Centralized directory management logic

## ⬆️ Upgrade Notes

This is a critical bug fix release. Users experiencing addon startup failures due to permission errors should upgrade immediately.

### Automatic Fallback
- The addon will automatically detect permission issues and use appropriate fallback directories
- No configuration changes required
- Existing data in `/data/uploads` will continue to be used when accessible

### Monitoring
- Check the addon logs for permission status during startup
- Use the new debug endpoint to monitor directory status
- Run the test script if troubleshooting is needed

---

**Full Changelog:** [v1.1.0...v1.1.1](https://github.com/Beast12/whorang-addon/compare/v1.1.0...v1.1.1)
