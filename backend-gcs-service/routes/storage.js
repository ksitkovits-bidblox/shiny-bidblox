// routes/storage.js
const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/uploadMiddleware');
const { validateCompany } = require('../middleware/companyValidation');
const storageController = require('../controllers/storageController');
const timeout = require('express-timeout-handler');
const geminiController = require('../controllers/geminiController');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n=== Pre-Validation Storage Request ===`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log('Headers:', {
    authorization: req.headers.authorization ? 'Bearer [token]' : 'missing',
    'x-company-name': req.headers['x-company-name'],
    'content-type': req.headers['content-type']
  });
  console.log(`====================`);
  next();
});



// File Management Routes
router.post('/companies/:companyName/library/:category/files', upload.array('files'), async (req, res) => {
  try {
    const { companyName, category } = req.params;
    const files = req.files;
    const { storage } = req.app.locals.services;
    
    const bucket = storage.bucket(`${process.env.BUCKET_PREFIX}-${companyName.toLowerCase()}`);
    
    const uploadPromises = files.map(async (file) => {
      const destination = `library/${category}/${file.originalname}`;
      await bucket.upload(file.path, {
        destination,
        metadata: {
          contentType: file.mimetype,
          category: category,
          uploadTime: new Date().toISOString()
        }
      });
      
      return {
        fileName: file.originalname,
        fileUrl: `gs://${bucket.name}/${destination}`,
        size: file.size,
        contentType: file.mimetype
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    res.json(uploadedFiles);

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: error.message });
  }
});


router.post(
  '/companies/:companyName/projects/:projectId/files',
  // Debug middleware specific to file upload
  (req, res, next) => {
    console.log('\n=== File Upload Request ===');
    console.log('Headers present:', {
      auth: !!req.headers.authorization,
      company: !!req.headers['x-company-name'],
      contentType: req.headers['content-type']
    });
    console.log('Params:', req.params);
    console.log('Files:', req.files ? 'present' : 'not present yet');
    console.log('=====================');
    next();
  },
  validateCompany,  // This middleware handles bucket creation/validation
  // Debug after validation
  (req, res, next) => {
    console.log('\n=== Post-Validation ===');
    console.log('User:', req.user);
    console.log('Company:', req.company);
    console.log('=====================');
    next();
  },
  upload.array('files'),
  storageController.uploadFiles
);

router.get(
  '/companies/:companyName/projects/:projectId/files',
  validateCompany,
  storageController.getFiles
);

router.get(
  '/companies/:companyName/projects/:projectId/files/:fileName',
  validateCompany,
  storageController.downloadFile
);

router.delete(
  '/companies/:companyName/projects/:projectId/files/:fileName',
  validateCompany,
  storageController.deleteFile
);

// Project Metadata Routes
router.post(
  '/companies/:companyName/projects/:projectId/metadata',
  validateCompany,
  storageController.updateProjectMetadata
);

// Analysis Routes
//router.post(
//  '/companies/:companyName/projects/:projectId/analyze',
//  validateCompany,
  //storageController.sendToGemini
//  geminiController.analyzeProject
//);

// Project Management Routes
router.get(
  '/companies/:companyName/projects',
  validateCompany,
  storageController.getProjects
);

router.get(
  '/companies/:companyName/projects/:projectId',
  validateCompany,
  storageController.getProject
);

router.post(
  '/companies/:companyName/projects',
  validateCompany,
  storageController.createProject
);

router.delete(
  '/companies/:companyName/projects/:projectId',
  validateCompany,
  storageController.deleteProject
);

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Storage Route Error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    headers: {
      authorization: req.headers.authorization ? 'present' : 'missing',
      'x-company-name': req.headers['x-company-name'],
      'content-type': req.headers['content-type']
    },
    params: req.params,
    company: req.company,
    user: req.user
  });
  
  if (err.code === 404) {
    return res.status(404).json({
      error: 'Resource not found',
      details: err.message
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      details: 'Maximum file size is 25MB'
    });
  }
  
  if (err.code === 'BUCKET_NOT_FOUND') {
    return res.status(404).json({
      error: 'Company storage not found',
      details: 'Unable to access company storage bucket'
    });
  }
  
  res.status(err.status || 500).json({
    error: 'An error occurred',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

module.exports = router;