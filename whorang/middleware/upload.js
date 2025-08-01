const multer = require('multer');
const path = require('path');

function createUploadMiddleware(directoryManager) {
  const facesUploadPath = directoryManager.getFacesPath();

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // The directory is already ensured at startup by the directoryManager
      cb(null, facesUploadPath);
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
      files: 10 // Max 10 files per request
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

  return upload;
}

module.exports = { createUploadMiddleware };
