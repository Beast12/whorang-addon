# WhoRang AI Doorbell Backend v1.1.2 Release Notes

**Release Date:** January 20, 2025  
**Version:** 1.1.2  
**Type:** Critical Bug Fix & Data Persistence Release

## 🚨 Critical Issues Resolved

### Fixed Database Permission Error (`SQLITE_CANTOPEN`)
**Problem:** The addon was failing to start due to SQLite database permission errors when trying to create/access `/data/whorang.db`. This prevented the addon from functioning completely.

**Solution:** Implemented DatabaseManager utility with comprehensive fallback system for database access.

### **CRITICAL**: Fixed Data Persistence Issue
**Problem:** **CRITICAL DATA LOSS ISSUE** - The Home Assistant addon configuration was missing the `/data` volume mapping, meaning:
- Database files were NOT persistent across addon restarts
- Upload files were NOT persistent across addon restarts  
- Users were losing ALL face recognition data on addon restart/Home Assistant reboot

**Solution:** Added proper volume mapping and implemented comprehensive persistence monitoring.

## 🔧 Technical Improvements

### 1. New DatabaseManager Utility
- **File:** `whorang/utils/databaseManager.js`
- **Purpose:** Centralized database path management with fallback support
- **Features:**
  - Primary path: `/data/whorang.db` (persistent storage)
  - Fallback path: `/app/whorang.db` (temporary storage with warnings)
  - Permission testing before database creation
  - Status reporting and warning system
  - Integration with existing DirectoryManager pattern

### 2. **CRITICAL FIX**: Home Assistant Volume Mapping
- **File:** `whorang/config.yaml`
- **Change:** Added `data:rw` to volume mapping
- **Impact:** This single line ensures:
  - Database persistence across addon restarts
  - Upload file persistence across addon restarts
  - No data loss on Home Assistant reboots
  - True data persistence for all users

### 3. Enhanced Database Configuration
- **File:** `whorang/config/database.js`
- **Improvements:**
  - Integrated DatabaseManager for path resolution
  - Comprehensive error handling with troubleshooting steps
  - Enhanced logging for database initialization
  - Fallback support with clear warnings
  - Status reporting for persistence monitoring

### 4. Enhanced Debug Endpoint
- **File:** `whorang/server.js`
- **Endpoint:** `GET /api/debug/directories`
- **New Features:**
  - Database status monitoring
  - Persistence warnings detection
  - Comprehensive environment reporting
  - Real-time status of both database and directory systems

### 5. Comprehensive Test Script
- **File:** `whorang/test_database_permissions.js`
- **Purpose:** Complete testing and validation of database and persistence functionality
- **Test Coverage:**
  - Environment variable validation
  - DatabaseManager functionality testing
  - DirectoryManager integration verification
  - Database connection and operations testing
  - File system permissions validation
  - Data persistence analysis
  - Debug endpoint simulation

### 6. Complete Documentation
- **File:** `whorang/DATABASE_PERSISTENCE_FIXES_README.md`
- **Content:**
  - Complete implementation guide
  - Troubleshooting documentation
  - Testing and validation procedures
  - Home Assistant integration details
  - Deployment and rollback procedures

## 🏠 Home Assistant Integration

### Data Persistence Strategy

**Primary Storage** (`/data` - Persistent):
- **Database:** `/data/whorang.db` - All face recognition data, person assignments, visitor history
- **Face Images:** `/data/uploads/faces/` - Face crop images
- **Thumbnails:** `/data/uploads/thumbnails/` - Thumbnail images
- **Persistence:** ✅ Survives addon restarts and Home Assistant reboots

**Fallback Storage** (`/app` - Temporary):
- **Database:** `/app/whorang.db` - Temporary database with warnings
- **Uploads:** `/app/uploads/` - Temporary file storage with warnings
- **Persistence:** ❌ Lost on restart (but addon still functions)

### Volume Mapping Configuration
```yaml
map:
  - ssl
  - share:rw
  - media:rw
  - backup:rw
  - data:rw  # ← CRITICAL ADDITION FOR DATA PERSISTENCE
```

## 🔍 Troubleshooting & Monitoring

### Success Indicators
Look for these indicators in the logs:

**Persistent Storage (Ideal):**
```
✅ Database will use primary path: /data/whorang.db
✅ Connected to SQLite database
✅ Directory ensured (sync): /data/uploads/faces
Database persistent: ✅ YES
Uploads persistent: ✅ YES
```

**Fallback Mode (Functional but Temporary):**
```
⚠️  Database will use fallback path: /app/whorang.db
⚠️  WARNING: Database is using temporary storage - data will be lost on restart!
Database persistent: ❌ NO
Uploads persistent: ❌ NO
```

### Validation Tools
- **Test Script:** `node test_database_permissions.js`
- **Debug Endpoint:** `GET /api/debug/directories`
- **Log Monitoring:** Clear persistence status in addon logs

### Common Issues & Solutions

**1. Database Still Using Fallback**
- **Cause:** `/data` directory not mounted or not writable
- **Solution:** Ensure `data:rw` is in addon volume mapping, restart addon
- **Verification:** Check `DATA_UPLOADS_WRITABLE` environment variable

**2. Data Loss After Restart**
- **Cause:** Using fallback storage instead of persistent storage
- **Solution:** Fix volume mapping and restart addon
- **Verification:** Check persistence status in debug endpoint

## 📊 Benefits

### Reliability Improvements
1. **Database Fallback:** Addon always starts, even with permission issues
2. **Data Persistence:** User data survives restarts and reboots
3. **Clear Warnings:** Users know when data is temporary vs persistent
4. **Comprehensive Testing:** Validation tools for troubleshooting

### User Experience
1. **No Data Loss:** Face recognition data persists across restarts
2. **Transparent Operation:** Clear logging shows what's happening
3. **Easy Debugging:** Debug endpoint and test script available
4. **Automatic Recovery:** System works in restricted environments

### Enterprise-Grade Features
1. **Production-Ready:** Reliable data persistence for production use
2. **Status Monitoring:** Real-time persistence system status
3. **Proactive Warnings:** Early detection of persistence issues
4. **Complete Documentation:** Troubleshooting and deployment guides

## ⬆️ Upgrade Notes

This is a **critical bug fix release**. Users experiencing:
- Addon startup failures due to database errors
- Data loss after addon restarts
- Missing face recognition data after Home Assistant reboots

Should upgrade immediately.

### Automatic Benefits
- The addon will automatically detect permission issues and use appropriate fallback
- Proper volume mapping ensures data persistence without user intervention
- Enhanced logging provides clear status of persistence systems
- No configuration changes required from users

### Post-Upgrade Validation
1. **Check Logs:** Look for persistence status indicators
2. **Test Persistence:** Restart addon and verify data remains
3. **Monitor Status:** Use debug endpoint to check persistence status
4. **Run Test Script:** Use test script if troubleshooting is needed

## 🎯 Critical Success

**Database Permission Error:** ✅ RESOLVED - Addon now starts successfully with proper database access

**Data Persistence Issue:** ✅ RESOLVED - Users will no longer lose face recognition data when restarting the addon or rebooting Home Assistant

**Enterprise-Grade Reliability:** ✅ ACHIEVED - Production-ready data persistence and monitoring

## 🚀 Impact

This release resolves the critical data loss issue and ensures enterprise-grade data persistence for all WhoRang users. The addon now provides:

- ✅ **Reliable Database Access** with fallback support
- ✅ **True Data Persistence** across addon restarts and HA reboots
- ✅ **Comprehensive Monitoring** with debug endpoints and test tools
- ✅ **Clear Status Reporting** for troubleshooting and validation
- ✅ **Automatic Fallback** for restricted permission environments
- ✅ **User Data Protection** preventing loss of face recognition data

**All face assignments, person data, and visitor history now persist across restarts.**

---

**Full Changelog:** [v1.1.1...v1.1.2](https://github.com/Beast12/whorang-addon/compare/v1.1.1...v1.1.2)

**The WhoRang addon now provides enterprise-grade data persistence and reliability!** 🎉
