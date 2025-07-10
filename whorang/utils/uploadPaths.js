const path = require('path');

/**
 * Centralized upload path configuration
 * Uses UPLOADS_PATH environment variable or defaults to 'uploads'
 */
class UploadPaths {
  constructor() {
    this.baseUploadPath = process.env.UPLOADS_PATH || 'uploads';
  }

  /**
   * Get the base upload directory path
   */
  getBaseUploadPath() {
    return this.baseUploadPath;
  }

  /**
   * Get the faces upload directory path
   */
  getFacesUploadPath() {
    return path.join(this.baseUploadPath, 'faces');
  }

  /**
   * Get the thumbnails upload directory path
   */
  getThumbnailsUploadPath() {
    return path.join(this.baseUploadPath, 'thumbnails');
  }

  /**
   * Get the temp upload directory path
   */
  getTempUploadPath() {
    return path.join(this.baseUploadPath, 'temp');
  }

  /**
   * Get a relative URL path for faces
   */
  getFacesUrlPath() {
    return `/${this.baseUploadPath}/faces`;
  }

  /**
   * Get a relative URL path for thumbnails
   */
  getThumbnailsUrlPath() {
    return `/${this.baseUploadPath}/thumbnails`;
  }

  /**
   * Get a relative URL path for general uploads
   */
  getUploadsUrlPath() {
    return `/${this.baseUploadPath}`;
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
