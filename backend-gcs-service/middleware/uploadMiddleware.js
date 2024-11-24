// src/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Helper function to ensure upload directory exists
const ensureUploadDir = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

// Configure multer storage with company-specific paths
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const companyName = req.company?.name || req.headers['x-company-name'];
      const projectId = req.params.projectId;
      
      if (!companyName) {
        return cb(new Error('Company name is required for file upload'));
      }

      // Create company and project specific upload path
      const uploadDir = path.join(
        'uploads',
        companyName.toLowerCase(),
        projectId || 'temp'
      );

      // Ensure directory exists
      await ensureUploadDir(uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Create unique filename while preserving original name and extension
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${uniqueSuffix}-${safeOriginalName}`;
    cb(null, fileName);
  }
});

// Configure multer upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB to match frontend
    files: 5, // Maximum 5 files per request
    fieldSize: 25 * 1024 * 1024 // 25MB for text fields
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

// Helper to clean up temporary files
const cleanupTempFiles = async (files) => {
  if (!files) return;
  
  const filePaths = Array.isArray(files) ? files : [files];
  await Promise.all(
    filePaths.map(file => 
      fs.unlink(file.path).catch(err => 
        console.error(`Failed to delete temp file ${file.path}:`, err)
      )
    )
  );
};

// Enhanced error handler
const handleUploadError = (error, req, res, next) => {
  // Clean up any uploaded files if an error occurs
  cleanupTempFiles(req.files).catch(err => 
    console.error('Error cleaning up temp files:', err)
  );

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'File is too large',
          details: 'Maximum file size is 25MB',
          code: error.code
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          details: 'Maximum of 5 files allowed per upload',
          code: error.code
        });
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({
          error: 'Field value too large',
          details: 'Maximum field size is 25MB',
          code: error.code
        });
      default:
        return res.status(400).json({
          error: 'File upload error',
          details: error.message,
          code: error.code
        });
    }
  }

  // Handle custom file type error
  if (error.message && error.message.includes('File type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      details: error.message,
      allowedTypes: [
        'PDF',
        'Word Documents',
        'Excel Spreadsheets',
        'Plain Text',
        'CSV'
      ]
    });
  }

  // Pass other errors to the global error handler
  next(error);
};

// Middleware to validate company before upload
const validateUploadRequest = (req, res, next) => {
  const companyName = req.company?.name || req.headers['x-company-name'];
  const projectId = req.params.projectId;

  if (!companyName) {
    return res.status(400).json({
      error: 'Missing company',
      details: 'Company name is required in headers or request object'
    });
  }

  if (!projectId) {
    return res.status(400).json({
      error: 'Missing project',
      details: 'Project ID is required for file upload'
    });
  }

  next();
};

module.exports = {
  upload,
  handleUploadError,
  validateUploadRequest,
  cleanupTempFiles
};