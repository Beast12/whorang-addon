const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const pathValidator = require('./pathValidator');

class DirectoryManager {
  constructor(configReader) {
    this.configReader = configReader;
    this.pathValidator = pathValidator;
    this.basePath = null;
    this.subdirectories = {};
  }

  async initialize() {
    const userPath = this.configReader.get('uploads_path');
    const fallbackPath = path.resolve(__dirname, '..', 'uploads');

    if (userPath && this.pathValidator.testWritePermissions(userPath)) {
      console.log(`Using user-configured uploads path: ${userPath}`);
      this.basePath = userPath;
    } else {
      console.log(`Falling back to default uploads path: ${fallbackPath}`);
      this.basePath = fallbackPath;
    }

    this.subdirectories = {
      faces: path.join(this.basePath, 'faces'),
      thumbnails: path.join(this.basePath, 'thumbnails'),
    };

    // Ensure all directories exist
    await this.ensureDirectory(this.basePath);
    for (const dir of Object.values(this.subdirectories)) {
      await this.ensureDirectory(dir);
    }
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`Directory not found, creating async: ${dirPath}`);
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        console.error(`Failed to access or create directory ${dirPath}`, error);
        throw error;
      }
    }
  }

  getPath(type) {
    if (this.subdirectories[type]) {
      return this.subdirectories[type];
    }
    if (type === 'base') {
      return this.basePath;
    }
    console.warn(`Requested unknown path type: '${type}'. Falling back to base path.`);
    return this.basePath;
  }
}

module.exports = DirectoryManager;
