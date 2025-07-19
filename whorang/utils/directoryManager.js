const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Directory Manager - Handles directory creation with fallback options
 * for Home Assistant addon environments where /data may not be writable
 */
class DirectoryManager {
  constructor() {
    this.primaryBasePath = process.env.UPLOADS_PATH || '/data/uploads';
    this.fallbackBasePath = '/app/uploads';
    this.isDataWritable = process.env.DATA_UPLOADS_WRITABLE === 'true';
    
    // Cache for directory existence checks
    this.directoryCache = new Map();
    
    console.log(`DirectoryManager initialized:`);
    console.log(`  Primary path: ${this.primaryBasePath}`);
    console.log(`  Fallback path: ${this.fallbackBasePath}`);
    console.log(`  Data writable: ${this.isDataWritable}`);
  }

  /**
   * Get the effective base path (primary or fallback)
   */
  getEffectiveBasePath() {
    return this.isDataWritable ? this.primaryBasePath : this.fallbackBasePath;
  }

  /**
   * Ensure a directory exists with proper error handling and fallback
   */
  async ensureDirectory(relativePath = '') {
    const primaryPath = path.join(this.primaryBasePath, relativePath);
    const fallbackPath = path.join(this.fallbackBasePath, relativePath);
    
    // Check cache first
    const cacheKey = relativePath || 'root';
    if (this.directoryCache.has(cacheKey)) {
      return this.directoryCache.get(cacheKey);
    }

    let effectivePath = primaryPath;
    let usedFallback = false;

    try {
      // Try primary path first
      await fs.mkdir(primaryPath, { recursive: true });
      
      // Test write permissions
      const testFile = path.join(primaryPath, '.write_test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      console.log(`✅ Directory ensured: ${primaryPath}`);
    } catch (error) {
      console.warn(`⚠️  Primary path failed (${primaryPath}): ${error.message}`);
      
      try {
        // Fallback to app directory
        await fs.mkdir(fallbackPath, { recursive: true });
        
        // Test write permissions for fallback
        const testFile = path.join(fallbackPath, '.write_test');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        
        effectivePath = fallbackPath;
        usedFallback = true;
        
        console.log(`✅ Fallback directory ensured: ${fallbackPath}`);
      } catch (fallbackError) {
        console.error(`❌ Both primary and fallback failed for ${relativePath}:`);
        console.error(`  Primary: ${error.message}`);
        console.error(`  Fallback: ${fallbackError.message}`);
        
        // Last resort: try relative path from current working directory
        try {
          const relativeFallbackPath = path.join(process.cwd(), 'uploads', relativePath);
          await fs.mkdir(relativeFallbackPath, { recursive: true });
          
          // Test write permissions for relative fallback
          const testFile = path.join(relativeFallbackPath, '.write_test');
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
          
          effectivePath = relativeFallbackPath;
          usedFallback = true;
          
          console.log(`✅ Relative fallback directory ensured: ${relativeFallbackPath}`);
        } catch (relativeError) {
          console.error(`❌ All directory creation attempts failed for ${relativePath}:`);
          console.error(`  Primary: ${error.message}`);
          console.error(`  Fallback: ${fallbackError.message}`);
          console.error(`  Relative: ${relativeError.message}`);
          throw new Error(`Failed to create directory: ${relativePath}`);
        }
      }
    }

    // Cache the result
    const result = { path: effectivePath, usedFallback };
    this.directoryCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Synchronous version for compatibility with existing code
   */
  ensureDirectorySync(relativePath = '') {
    const primaryPath = path.join(this.primaryBasePath, relativePath);
    const fallbackPath = path.join(this.fallbackBasePath, relativePath);
    
    // Check cache first
    const cacheKey = relativePath || 'root';
    if (this.directoryCache.has(cacheKey)) {
      return this.directoryCache.get(cacheKey);
    }

    let effectivePath = primaryPath;
    let usedFallback = false;

    try {
      // Try primary path first
      fsSync.mkdirSync(primaryPath, { recursive: true });
      
      // Test write permissions
      const testFile = path.join(primaryPath, '.write_test');
      fsSync.writeFileSync(testFile, 'test');
      fsSync.unlinkSync(testFile);
      
      console.log(`✅ Directory ensured (sync): ${primaryPath}`);
    } catch (error) {
      console.warn(`⚠️  Primary path failed (sync, ${primaryPath}): ${error.message}`);
      
      try {
        // Fallback to app directory
        fsSync.mkdirSync(fallbackPath, { recursive: true });
        
        // Test write permissions for fallback
        const testFile = path.join(fallbackPath, '.write_test');
        fsSync.writeFileSync(testFile, 'test');
        fsSync.unlinkSync(testFile);
        
        effectivePath = fallbackPath;
        usedFallback = true;
        
        console.log(`✅ Fallback directory ensured (sync): ${fallbackPath}`);
      } catch (fallbackError) {
        console.error(`❌ Both primary and fallback failed (sync) for ${relativePath}:`);
        console.error(`  Primary: ${error.message}`);
        console.error(`  Fallback: ${fallbackError.message}`);
        
        // Last resort: try relative path from current working directory
        try {
          const relativeFallbackPath = path.join(process.cwd(), 'uploads', relativePath);
          fsSync.mkdirSync(relativeFallbackPath, { recursive: true });
          
          // Test write permissions for relative fallback
          const testFile = path.join(relativeFallbackPath, '.write_test');
          fsSync.writeFileSync(testFile, 'test');
          fsSync.unlinkSync(testFile);
          
          effectivePath = relativeFallbackPath;
          usedFallback = true;
          
          console.log(`✅ Relative fallback directory ensured (sync): ${relativeFallbackPath}`);
        } catch (relativeError) {
          console.error(`❌ All directory creation attempts failed for ${relativePath}:`);
          console.error(`  Primary: ${error.message}`);
          console.error(`  Fallback: ${fallbackError.message}`);
          console.error(`  Relative: ${relativeError.message}`);
          throw new Error(`Failed to create directory: ${relativePath}`);
        }
      }
    }

    // Cache the result
    const result = { path: effectivePath, usedFallback };
    this.directoryCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Get the effective path for a subdirectory
   */
  getPath(relativePath = '') {
    try {
      const result = this.ensureDirectorySync(relativePath);
      return result.path;
    } catch (error) {
      // If directory creation fails, return the fallback path
      console.warn(`Failed to ensure directory ${relativePath}, returning fallback`);
      return path.join(this.fallbackBasePath, relativePath);
    }
  }

  /**
   * Get faces upload directory
   */
  getFacesPath() {
    return this.getPath('faces');
  }

  /**
   * Get thumbnails upload directory
   */
  getThumbnailsPath() {
    return this.getPath('thumbnails');
  }

  /**
   * Get temp upload directory
   */
  getTempPath() {
    return this.getPath('temp');
  }

  /**
   * Clear directory cache (useful for testing)
   */
  clearCache() {
    this.directoryCache.clear();
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      primaryBasePath: this.primaryBasePath,
      fallbackBasePath: this.fallbackBasePath,
      isDataWritable: this.isDataWritable,
      effectiveBasePath: this.getEffectiveBasePath(),
      cachedDirectories: Array.from(this.directoryCache.keys())
    };
  }
}

// Export singleton instance
module.exports = new DirectoryManager();
