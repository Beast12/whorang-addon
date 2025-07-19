
const multer = require('multer');
const path = require('path');
const directoryManager = require('../utils/directoryManager');
const uploadPaths = require('../utils/uploadPaths');

// Initialize upload directory with robust error handling
let uploadDir;
let uploadDirStatus;

try {
  // Use DirectoryManager for robust directory creation
  const result = directoryManager.ensureDirectorySync('faces');
  uploadDir = result.path;
  uploadDirStatus = result;
  
  console.log(`✅ Upload middleware initialized:`);
  console.log(`  Directory: ${uploadDir}`);
  console.log(`  Used fallback: ${result.usedFallback}`);
} catch (error) {
  console.error('❌ Failed to initialize upload directory:', error);
  
  // Last resort fallback
  uploadDir = path.join(__dirname, '..', 'uploads', 'faces');
  console.log(`⚠️  Using last resort directory: ${uploadDir}`);
  
  try {
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (lastResortError) {
    console.error('❌ Last resort directory creation failed:', lastResortError);
    throw new Error('Unable to create any upload directory');
  }
}

// Configure multer with the determined upload directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure directory still exists at upload time
    try {
      const result = directoryManager.ensureDirectorySync('faces');
      cb(null, result.path);
    } catch (error) {
      console.warn('Directory check failed during upload, using cached path:', error.message);
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per request
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Add error handling middleware
upload.handleError = function(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 5 files per request.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field.' });
    }
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed.' });
  }
  
  console.error('Upload error:', error);
  return res.status(500).json({ error: 'Upload failed. Please try again.' });
};

// Export both the upload middleware and status information
module.exports = upload;
module.exports.getStatus = function() {
  return {
    uploadDir,
    uploadDirStatus,
    directoryManagerStatus: directoryManager.getStatus()
  };
};
