const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const configReader = require('./configReader');
const pathValidator = require('./pathValidator');

/**
 * Database Manager - Handles database path with fallback options
 * Uses user-configured database path from Home Assistant add-on or environment variables
 */
class DatabaseManager {
  constructor() {
    // Get user-configured database path
    this.primaryDbPath = configReader.getDatabasePath();
    this.fallbackDbPath = '/app/whorang.db';
    
    // Validate the user-configured database path
    this.validatePrimaryPath();
    
    console.log(`DatabaseManager initialized:`);
    console.log(`  User-configured DB path: ${this.primaryDbPath}`);
    console.log(`  Fallback DB path: ${this.fallbackDbPath}`);
    console.log(`  Effective DB path: ${this.getEffectiveDatabasePath()}`);
  }

  /**
   * Validate the user-configured primary database path
   */
  validatePrimaryPath() {
    const validation = pathValidator.validateDatabasePath(this.primaryDbPath);
    
    if (validation.isValid) {
      console.log(`✅ User-configured database path is valid: ${this.primaryDbPath}`);
      this.isDataWritable = true;
      
      // Log any warnings
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          console.warn(`⚠️  ${warning}`);
        });
      }
    } else {
      console.warn(`⚠️  User-configured database path is not accessible: ${validation.error}`);
      console.warn(`⚠️  Will use fallback path: ${this.fallbackDbPath}`);
      this.isDataWritable = false;
    }
  }

  /**
   * Get the effective database path with fallback support
   */
  getEffectiveDatabasePath() {
    const isAddon = configReader.isAddonMode();
    const pathsToTry = [
      this.primaryDbPath,
      // In addon mode, the correct fallback is always in /data
      isAddon ? '/data/whorang.db' : null,
      // For standalone, or if /data fails, fallback to /app (non-persistent)
      this.fallbackDbPath,
    ].filter(p => p && typeof p === 'string'); // Filter out null/invalid entries

    // Create a unique set of paths to try
    const uniquePaths = [...new Set(pathsToTry)];

    for (const dbPath of uniquePaths) {
      try {
        const dir = path.dirname(dbPath);

        // Ensure the directory exists
        fsSync.mkdirSync(dir, { recursive: true });

        // Test write permissions
        const testFile = path.join(dir, '.db_write_test');
        fsSync.writeFileSync(testFile, 'test');
        fsSync.unlinkSync(testFile);

        console.log(`✅ Database path validated. Using: ${dbPath}`);
        if (dbPath !== this.primaryDbPath) {
          console.warn(`⚠️  Using fallback database path. Check your configuration if this is not intended.`);
        }
        return dbPath;
      } catch (error) {
        console.warn(`⚠️  Could not use path '${dbPath}': ${error.message}`);
      }
    }

    // If all paths fail, throw a definitive error
    const error = new Error('Unable to find a writable location for the database.');
    console.error(`❌ Database path resolution failed. Checked: ${uniquePaths.join(', ')}`);
    throw error;
  }

  /**
   * Get status information
   */
  getStatus() {
    try {
      const effectivePath = this.getEffectiveDatabasePath();
      const isPersistent = effectivePath === this.primaryDbPath;
      
      return {
        primaryDbPath: this.primaryDbPath,
        fallbackDbPath: this.fallbackDbPath,
        effectivePath: effectivePath,
        isPersistent: isPersistent,
        isDataWritable: this.isDataWritable,
        warning: isPersistent ? null : 'Database is using temporary storage - data will be lost on restart!'
      };
    } catch (error) {
      return {
        primaryDbPath: this.primaryDbPath,
        fallbackDbPath: this.fallbackDbPath,
        effectivePath: null,
        isPersistent: false,
        isDataWritable: this.isDataWritable,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new DatabaseManager();
