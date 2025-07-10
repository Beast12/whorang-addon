
const multer = require('multer');
const fs = require('fs');
const uploadPaths = require('../utils/uploadPaths');

// Get upload directory from centralized configuration
const uploadDir = uploadPaths.getFacesUploadPath();

// Ensure upload directory exists with proper error handling
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created faces upload directory:', uploadDir);
  }
} catch (error) {
  console.error('Failed to create faces upload directory:', error);
}

const upload = multer({ dest: uploadDir });

module.exports = upload;
