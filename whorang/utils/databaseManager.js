const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const pathValidator = require('./pathValidator');

/**
 * Database Manager - Handles database path with fallback options
 * Uses user-configured database path from Home Assistant add-on or environment variables
 */
class DatabaseManager {
  constructor(configReader) {
    this.configReader = configReader;
    this.primaryDbPath = this.configReader.get('database_path');
    this.fallbackDbPath = path.resolve(__dirname, '..', 'whorang.db');
    this.effectiveDbPath = null; // This will be set in initialize()
    this.db = null;
  }

  initialize() {
    const isAddon = this.configReader.get('WHORANG_ADDON_MODE');
    const pathsToTry = [
      this.primaryDbPath,
      isAddon ? '/data/whorang.db' : null, // Addon-specific fallback
      this.fallbackDbPath,
    ].filter(p => p && typeof p === 'string');

    const uniquePaths = [...new Set(pathsToTry)];

    for (const dbPath of uniquePaths) {
      // Use the intelligent pathValidator to test permissions without causing EACCES errors.
      if (pathValidator.testWritePermissions(dbPath, 'file')) {
        this.effectiveDbPath = dbPath;
        console.log(`✅ Database path validated. Using: ${this.effectiveDbPath}`);
        if (this.effectiveDbPath !== this.primaryDbPath) {
          console.warn(`⚠️  Using fallback database path. Check your configuration if this is not intended.`);
        }
        return; // Exit after finding the first valid path
      }
      console.warn(`⚠️  Could not use path '${dbPath}', permissions check failed.`);
    }

    // If all paths fail, throw a definitive error
    const error = new Error('Unable to find a writable location for the database.');
    console.error(`❌ Database path resolution failed. Checked: ${uniquePaths.join(', ')}`);
    throw error;
  }

  getEffectiveDatabasePath() {
    if (!this.effectiveDbPath) {
      // This should not happen if initialize() was called, but as a safeguard:
      this.initialize();
    }
    return this.effectiveDbPath;
  }

  getStatus() {
    const isPersistent = this.effectiveDbPath === this.primaryDbPath;
    return {
      primaryDbPath: this.primaryDbPath,
      fallbackDbPath: this.fallbackDbPath,
      effectivePath: this.effectiveDbPath,
      isPersistent: isPersistent,
      isDataWritable: !!this.effectiveDbPath,
      warning: isPersistent ? null : 'Database is using temporary storage - data will be lost on restart!',
    };
  }
}

// Export singleton instance
module.exports = DatabaseManager;
