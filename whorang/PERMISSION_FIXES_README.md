# Home Assistant Addon Permission Fixes

This document describes the comprehensive fixes implemented to resolve permission issues when creating upload directories in the Home Assistant addon environment.

## Problem Summary

The addon was failing to start due to `EACCES` permission denied errors when trying to create directories in `/data/uploads/faces`. This occurred because:

1. The Node.js process didn't have write permissions to the `/data` directory
2. Directory creation was attempted in multiple places without proper error handling
3. No fallback mechanism existed when `/data` wasn't writable
4. Home Assistant volume mounting created permission conflicts

## Solution Overview

A **multi-layered approach** was implemented to ensure robust directory handling:

### 1. Enhanced Docker Entrypoint (`docker-entrypoint.sh`)

**Changes:**
- Creates both `/data/uploads/*` and `/app/uploads/*` directories
- Tests write permissions before starting the application
- Sets `DATA_UPLOADS_WRITABLE` environment variable based on test results
- Provides clear logging for debugging permission issues

**Key Features:**
```bash
# Test write permissions for /data/uploads
if su-exec node touch /data/uploads/test_write 2>/dev/null; then
    export DATA_UPLOADS_WRITABLE=true
else
    export DATA_UPLOADS_WRITABLE=false
fi
```

### 2. DirectoryManager Utility (`utils/directoryManager.js`)

**Purpose:** Centralized directory management with fallback support

**Key Features:**
- **Primary/Fallback Strategy**: Tries `/data/uploads` first, falls back to `/app/uploads`
- **Write Permission Testing**: Validates directories are actually writable
- **Caching**: Avoids repeated directory creation attempts
- **Comprehensive Logging**: Clear status reporting for debugging

**Usage:**
```javascript
const directoryManager = require('./utils/directoryManager');

// Ensure directory exists with fallback
const result = await directoryManager.ensureDirectory('faces');
console.log(`Directory: ${result.path}, Used fallback: ${result.usedFallback}`);
```

### 3. Enhanced Upload Middleware (`middleware/upload.js`)

**Changes:**
- Uses DirectoryManager for robust directory creation
- Implements multiple fallback levels
- Provides detailed error handling and logging
- Includes file size limits and type validation

**Fallback Hierarchy:**
1. DirectoryManager primary path (`/data/uploads/faces`)
2. DirectoryManager fallback path (`/app/uploads/faces`)
3. Last resort relative path (`../uploads/faces`)

### 4. Updated Upload Paths (`utils/uploadPaths.js`)

**Integration:** Now uses DirectoryManager internally while maintaining backward compatibility

**Benefits:**
- Existing code continues to work unchanged
- Automatic fallback support for all path operations
- Consistent behavior across all services

### 5. Face Cropping Services Updates

**Services Updated:**
- `faceCroppingService.js`
- `faceCroppingServiceLite.js`
- `faceCroppingServiceSharp.js`

**Changes:**
- Integrated DirectoryManager for directory creation
- Enhanced error handling and logging
- Fallback path support for all operations

### 6. Dockerfile Improvements

**Changes:**
- Pre-creates `/data/uploads` directory structure
- Attempts to set proper ownership (with graceful failure)
- Ensures fallback directories always exist

```dockerfile
# Create /data directory structure for Home Assistant addon
RUN mkdir -p /data/uploads/faces /data/uploads/temp /data/uploads/thumbnails

# Try to set ownership of /data directory (may fail in some HA configurations, that's OK)
RUN chown -R node:node /data 2>/dev/null || echo "Warning: Could not set ownership of /data directory"
```

## Testing and Debugging

### 1. Test Script

Run the comprehensive test script:
```bash
node test_directory_permissions.js
```

This tests:
- DirectoryManager functionality
- Directory creation and write permissions
- Upload middleware status
- Face cropping service initialization

### 2. Debug Endpoint

Access the debug endpoint to check directory status:
```
GET /api/debug/directories
```

Returns:
- DirectoryManager status
- Upload middleware configuration
- Environment variables
- Current directory paths and permissions

### 3. Log Analysis

Look for these log messages during startup:

**Success Indicators:**
```
✅ /data/uploads is writable
✅ Upload middleware initialized: /data/uploads/faces (fallback: false)
✅ Face cropping service initialized
```

**Fallback Indicators:**
```
⚠️ /data/uploads is not writable, will use /app/uploads as fallback
✅ Fallback directory ensured: /app/uploads/faces
```

**Error Indicators:**
```
❌ Both primary and fallback failed for faces
❌ Last resort directory creation failed
```

## Home Assistant Integration

### Volume Mapping

The addon configuration (`config.yaml`) includes:
```yaml
map:
  - ssl
  - share:rw
  - media:rw
  - backup:rw
```

### Environment Variables

Key environment variables set by the addon:
- `UPLOADS_PATH=/data/uploads` - Primary upload directory
- `DATA_UPLOADS_WRITABLE=true/false` - Set by entrypoint script

### Persistent Storage

- **Primary**: `/data/uploads` - Persistent across addon restarts
- **Fallback**: `/app/uploads` - Temporary, lost on restart

## Troubleshooting

### Common Issues

1. **Permission Denied on /data**
   - **Cause**: Home Assistant volume permissions
   - **Solution**: Automatic fallback to `/app/uploads`
   - **Impact**: Files lost on restart (temporary storage)

2. **Directory Creation Fails**
   - **Cause**: Filesystem issues or disk space
   - **Solution**: Check logs, verify disk space
   - **Debug**: Use test script and debug endpoint

3. **Upload Failures**
   - **Cause**: Directory not writable after creation
   - **Solution**: DirectoryManager validates write permissions
   - **Debug**: Check `/api/debug/directories` endpoint

### Log Monitoring

Monitor these log patterns:

**Startup Success:**
```
📁 Setting up directories...
✅ /data/uploads is writable
✅ Upload middleware initialized
✅ Face cropping service initialized
```

**Fallback Mode:**
```
⚠️ /data/uploads is not writable, will use /app/uploads as fallback
✅ Fallback directory ensured
```

**Critical Errors:**
```
❌ Both primary and fallback failed
❌ Unable to create any upload directory
```

## Benefits of This Solution

1. **Reliability**: Multiple fallback levels ensure the addon always starts
2. **Transparency**: Clear logging shows exactly what's happening
3. **Debugging**: Comprehensive status reporting and test tools
4. **Compatibility**: Works in various Home Assistant configurations
5. **Performance**: Caching avoids repeated directory operations
6. **Maintainability**: Centralized directory management logic

## Future Considerations

1. **Persistent Fallback**: Consider mounting `/app/uploads` as a volume for persistence
2. **Permission Repair**: Implement automatic permission fixing where possible
3. **Health Monitoring**: Add periodic directory health checks
4. **User Notification**: Alert users when fallback mode is active

## Files Modified

- `docker-entrypoint.sh` - Enhanced directory setup and permission testing
- `utils/directoryManager.js` - New centralized directory management
- `utils/uploadPaths.js` - Integrated DirectoryManager support
- `middleware/upload.js` - Robust upload handling with fallbacks
- `services/faceCroppingService*.js` - Updated all face cropping services
- `server.js` - Added debug endpoint
- `Dockerfile` - Pre-create directory structure
- `test_directory_permissions.js` - Comprehensive test script

This comprehensive solution ensures the Home Assistant addon works reliably across different deployment scenarios while providing clear visibility into directory and permission status.
