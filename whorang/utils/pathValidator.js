const fs = require('fs');
const path = require('path');

/**
 * Path Validator - Validates and sanitizes file system paths
 * Ensures paths are safe, accessible, and writable
 */
class PathValidator {
  constructor() {
    this.validationCache = new Map();
  }

  /**
   * Validate a path for safety and accessibility
   */
  validatePath(inputPath, options = {}) {
    const {
      mustExist = false,
      mustBeWritable = false,
      createIfMissing = false,
      type = 'directory' // 'directory' or 'file'
    } = options;

    // Check cache first
    const cacheKey = `${inputPath}_${JSON.stringify(options)}`;
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey);
    }

    const result = {
      isValid: false,
      sanitizedPath: null,
      exists: false,
      isWritable: false,
      error: null,
      warnings: []
    };

    try {
      // Sanitize the path
      const sanitizedPath = path.resolve(inputPath);
      result.sanitizedPath = sanitizedPath;

      // Security check - prevent path traversal
      if (this.containsPathTraversal(inputPath)) {
        result.error = 'Path contains potentially dangerous traversal patterns';
        this.validationCache.set(cacheKey, result);
        return result;
      }

      // Check if path exists
      result.exists = fs.existsSync(sanitizedPath);

      // If path doesn't exist and we should create it
      if (!result.exists && createIfMissing) {
        try {
          if (type === 'directory') {
            fs.mkdirSync(sanitizedPath, { recursive: true });
            result.exists = true;
            console.log(`✅ Created directory: ${sanitizedPath}`);
          } else {
            // For files, create the parent directory
            const parentDir = path.dirname(sanitizedPath);
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true });
              console.log(`✅ Created parent directory: ${parentDir}`);
            }
          }
        } catch (createError) {
          result.error = `Failed to create path: ${createError.message}`;
          this.validationCache.set(cacheKey, result);
          return result;
        }
      }

      // Check if path must exist
      if (mustExist && !result.exists) {
        result.error = `Path does not exist: ${sanitizedPath}`;
        this.validationCache.set(cacheKey, result);
        return result;
      }

      // Check write permissions if required
      if (mustBeWritable || result.exists) {
        result.isWritable = this.testWritePermissions(sanitizedPath, type);
        
        if (mustBeWritable && !result.isWritable) {
          result.error = `Path is not writable: ${sanitizedPath}`;
          this.validationCache.set(cacheKey, result);
          return result;
        }
      }

      // Add warnings for common issues
      if (sanitizedPath.includes('/tmp/')) {
        result.warnings.push('Path is in temporary directory - data may be lost on restart');
      }

      if (sanitizedPath.startsWith('/app/')) {
        result.warnings.push('Path is in application directory - may not persist across container restarts');
      }

      result.isValid = true;

    } catch (error) {
      result.error = `Path validation failed: ${error.message}`;
    }

    // Cache the result
    this.validationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Test write permissions for a path
   */
  testWritePermissions(targetPath, type = 'directory') {
    try {
      let testPath;
      
      if (type === 'directory') {
        if (!fs.existsSync(targetPath)) {
          return false;
        }
        testPath = path.join(targetPath, '.write_test_' + Date.now());
      } else {
        // For files, test the parent directory
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) {
          return false;
        }
        testPath = path.join(parentDir, '.write_test_' + Date.now());
      }

      // Try to write a test file
      fs.writeFileSync(testPath, 'test');
      fs.unlinkSync(testPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check for path traversal patterns
   */
  containsPathTraversal(inputPath) {
    const dangerous = [
      '../',
      '..\\',
      '/..',
      '\\..',
      '%2e%2e',
      '%252e%252e',
      '0x2e0x2e',
      '..%2f',
      '..%5c'
    ];

    const lowerPath = inputPath.toLowerCase();
    return dangerous.some(pattern => lowerPath.includes(pattern));
  }

  /**
   * Validate database path specifically
   */
  validateDatabasePath(dbPath) {
    const result = this.validatePath(dbPath, {
      mustBeWritable: true,
      createIfMissing: true,
      type: 'file'
    });

    // Additional database-specific validations
    if (result.isValid) {
      const ext = path.extname(dbPath).toLowerCase();
      if (ext !== '.db' && ext !== '.sqlite' && ext !== '.sqlite3') {
        result.warnings.push('Database file does not have a standard SQLite extension');
      }

      // Check if database file is too large (>1GB warning)
      if (result.exists) {
        try {
          const stats = fs.statSync(dbPath);
          if (stats.size > 1024 * 1024 * 1024) {
            result.warnings.push('Database file is larger than 1GB - consider cleanup');
          }
        } catch (error) {
          // Ignore stat errors
        }
      }
    }

    return result;
  }

  /**
   * Validate uploads directory path specifically
   */
  validateUploadsPath(uploadsPath) {
    const result = this.validatePath(uploadsPath, {
      mustBeWritable: true,
      createIfMissing: true,
      type: 'directory'
    });

    // Additional uploads-specific validations
    if (result.isValid) {
      // Check available disk space (warn if <1GB)
      try {
        const stats = fs.statSync(uploadsPath);
        // Note: fs.statSync doesn't provide disk space info
        // This would require additional libraries like 'statvfs' for accurate disk space
        // For now, we'll just validate the directory structure
        
        // Ensure subdirectories can be created
        const subdirs = ['faces', 'temp', 'thumbnails'];
        for (const subdir of subdirs) {
          const subdirPath = path.join(uploadsPath, subdir);
          const subdirResult = this.validatePath(subdirPath, {
            createIfMissing: true,
            mustBeWritable: true,
            type: 'directory'
          });
          
          if (!subdirResult.isValid) {
            result.warnings.push(`Cannot create/access subdirectory: ${subdir}`);
          }
        }
      } catch (error) {
        result.warnings.push(`Could not validate uploads directory structure: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Get validation status for debugging
   */
  getStatus() {
    return {
      cacheSize: this.validationCache.size,
      cachedPaths: Array.from(this.validationCache.keys())
    };
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }

  /**
   * Validate multiple paths at once
   */
  validatePaths(pathsConfig) {
    const results = {};
    
    for (const [name, config] of Object.entries(pathsConfig)) {
      const { path: pathValue, ...options } = config;
      results[name] = this.validatePath(pathValue, options);
    }
    
    return results;
  }

  /**
   * Get recommended fallback path for a given primary path
   */
  getRecommendedFallback(primaryPath, type = 'directory') {
    // Extract the base name from the primary path
    const baseName = path.basename(primaryPath);
    
    if (type === 'directory') {
      return path.join('/app', baseName);
    } else {
      return path.join('/app', baseName);
    }
  }
}

// Export singleton instance
module.exports = new PathValidator();
