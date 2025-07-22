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
    try {
      // Test if we can write to the primary path directory
      const primaryDir = path.dirname(this.primaryDbPath);
      
      // Check if directory exists and is writable
      if (fsSync.existsSync(primaryDir)) {
        try {
          // Test write permissions
          const testFile = path.join(primaryDir, '.db_write_test');
          fsSync.writeFileSync(testFile, 'test');
          fsSync.unlinkSync(testFile);
          
          console.log(`✅ Database will use primary path: ${this.primaryDbPath}`);
          return this.primaryDbPath;
        } catch (writeError) {
          console.warn(`⚠️  Primary database directory not writable: ${writeError.message}`);
        }
      } else {
        console.warn(`⚠️  Primary database directory doesn't exist: ${primaryDir}`);
      }
      
      // Fallback to app directory
      const fallbackDir = path.dirname(this.fallbackDbPath);
      try {
        // Ensure fallback directory exists
        fsSync.mkdirSync(fallbackDir, { recursive: true });
        
        // Test write permissions
        const testFile = path.join(fallbackDir, '.db_write_test');
        fsSync.writeFileSync(testFile, 'test');
        fsSync.unlinkSync(testFile);
        
        console.log(`✅ Database will use fallback path: ${this.fallbackDbPath}`);
        console.warn(`⚠️  WARNING: Database is using temporary storage - data will be lost on restart!`);
        return this.fallbackDbPath;
      } catch (fallbackError) {
        console.error(`❌ Both primary and fallback database paths failed:`);
        console.error(`  Primary: ${primaryDir} - not accessible`);
        console.error(`  Fallback: ${fallbackError.message}`);
        throw new Error('Unable to find writable location for database');
      }
    } catch (error) {
      console.error(`❌ Database path resolution failed: ${error.message}`);
      throw error;
    }
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
