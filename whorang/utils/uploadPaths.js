const path = require('path');
const directoryManager = require('./directoryManager');

/**
 * Centralized upload path configuration
 * Now integrates with DirectoryManager for robust path handling
 */
class UploadPaths {
  constructor() {
    this.baseUploadPath = process.env.UPLOADS_PATH || '/data/uploads';
    this.directoryManager = directoryManager;
  }

  /**
   * Get the base upload directory path (with fallback support)
   */
  getBaseUploadPath() {
    try {
      return this.directoryManager.getPath();
    } catch (error) {
      console.warn('Failed to get base upload path, using configured path:', error.message);
      return this.baseUploadPath;
    }
  }

  /**
   * Get the faces upload directory path (with fallback support)
   */
  getFacesUploadPath() {
    try {
      return this.directoryManager.getFacesPath();
    } catch (error) {
      console.warn('Failed to get faces upload path, using fallback:', error.message);
      return path.join(this.baseUploadPath, 'faces');
    }
  }

  /**
   * Get the thumbnails upload directory path (with fallback support)
   */
  getThumbnailsUploadPath() {
    try {
      return this.directoryManager.getThumbnailsPath();
    } catch (error) {
      console.warn('Failed to get thumbnails upload path, using fallback:', error.message);
      return path.join(this.baseUploadPath, 'thumbnails');
    }
  }

  /**
   * Get the temp upload directory path (with fallback support)
   */
  getTempUploadPath() {
    try {
      return this.directoryManager.getTempPath();
    } catch (error) {
      console.warn('Failed to get temp upload path, using fallback:', error.message);
      return path.join(this.baseUploadPath, 'temp');
    }
  }

  /**
   * Get a relative URL path for faces
   */
  getFacesUrlPath() {
    // Ensure no double slashes when baseUploadPath starts with /
    const basePath = this.baseUploadPath.startsWith('/') ? this.baseUploadPath : `/${this.baseUploadPath}`;
    return `${basePath}/faces`;
  }

  /**
   * Get a relative URL path for thumbnails
   */
  getThumbnailsUrlPath() {
    // Ensure no double slashes when baseUploadPath starts with /
    const basePath = this.baseUploadPath.startsWith('/') ? this.baseUploadPath : `/${this.baseUploadPath}`;
    return `${basePath}/thumbnails`;
  }

  /**
   * Get a relative URL path for general uploads
   */
  getUploadsUrlPath() {
    // Ensure no double slashes when baseUploadPath starts with /
    return this.baseUploadPath.startsWith('/') ? this.baseUploadPath : `/${this.baseUploadPath}`;
  }

  /**
   * Check if a URL is an upload path
   */
  isUploadPath(url) {
    return url.startsWith(`/${this.baseUploadPath}/`) || url.startsWith(`./${this.baseUploadPath}/`);
  }

  /**
   * Resolve an upload URL to a full file system path
   */
  resolveUploadPath(uploadUrl) {
    if (uploadUrl.startsWith(`/${this.baseUploadPath}/`)) {
      // For absolute paths like "/data/uploads/faces/file.jpg", return as-is
      // since they're already absolute file system paths
      return uploadUrl;
    } else if (uploadUrl.startsWith(`./${this.baseUploadPath}/`)) {
      // For relative paths like "./uploads/faces/file.jpg", resolve relative to app directory
      return path.join(__dirname, '..', uploadUrl.substring(2));
    } else if (uploadUrl.startsWith(`uploads/`)) {
      // For legacy "uploads/" paths, resolve relative to app directory
      return path.join(__dirname, '..', uploadUrl);
    }
    return uploadUrl;
  }

  /**
   * Create a face image URL path
   */
  createFaceImageUrl(filename) {
    return `${this.getFacesUrlPath()}/${filename}`;
  }

  /**
   * Create a thumbnail image URL path
   */
  createThumbnailUrl(filename) {
    return `${this.getThumbnailsUrlPath()}/${filename}`;
  }

  /**
   * Create a general upload URL path
   */
  createUploadUrl(filename) {
    return `${this.getUploadsUrlPath()}/${filename}`;
  }
}

// Export singleton instance
module.exports = new UploadPaths();
