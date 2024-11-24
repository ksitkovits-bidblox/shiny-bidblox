// routes/projectRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); 
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const { ProjectService, normalizeCompanyName } = require('../services/projectService');  // Updated import
const projectController = require('../controllers/projectController');
const { validateCompany } = require('../middleware/companyValidation');
const geminiController = require('../controllers/geminiController');
const aiRoutes = express.Router({ mergeParams: true });
const { analyzeProject } = require('../controllers/geminiController');
const admin = require('firebase-admin');


// Initialize ProjectService once for the router
let projectService;
// Initialization middleware - runs once per request
router.use((req, res, next) => {
  try {
    // Only initialize if not already initialized
    if (!projectService) {
      projectService = new ProjectService();
      console.log('ProjectService initialized in routes');
    }
    // Make service available on request object
    req.projectService = projectService;
    next();
  } catch (error) {
    console.error('Failed to initialize ProjectService:', error);
    next(error);
  }
});

router.use((req, res, next) => {
  console.log('Project route debug:', {
    params: req.params,
    companyName: req.params.companyName,
    headerCompany: req.headers['x-company-name'],
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
  next();
});


// Debug middleware
router.use((req, res, next) => {
  console.log('Project route debug:', {
    params: req.params,
    companyName: req.params.companyName,
    headerCompany: req.headers['x-company-name'],
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
  next();
});

// Project CRUD routes


// Executive Summary endpoint
router.post(
  '/projects/:projectId/ai/executive-summary',
  validateCompany,
  geminiController.generateExecutiveSummary
);



// routes/projectRoutes.js

// Add debugging middleware
router.use((req, res, next) => {
  console.log('ProjectRoutes request:', {
    method: req.method,
    fullUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
    company: req.headers['x-company-name']
  });
  next();
});

router.post('/projects/:projectId/analyze', async (req, res) => {
  try {
    const company = req.headers['x-company-name'];
    if (!company) {
      throw new Error('Company name header is required');
    }

    console.log('Analysis route hit:', {
      fullPath: req.originalUrl,
      basePath: req.baseUrl,
      path: req.path,
      company,
      projectId: req.params.projectId
    });

    // Add company info to request
    req.company = {
      name: company,
      bucket: req.app.locals.services.getStorageBucket(`placeholder@${company}.com`)
    };

    await analyzeProject(req, res);
  } catch (error) {
    console.error('Route error:', {
      error: error.message,
      stack: error.stack,
      company: req.headers['x-company-name'],
      projectId: req.params.projectId
    });
    res.status(500).json({ error: error.message });
  }
});




router.get('/projects', validateCompany, async (req, res, next) => {
  try {
    const { companyName } = req.params;
    const { bucket } = req.company;  
    const { storage } = req.app.locals.services; 

    
    console.log('Fetching projects for company:', companyName);

    // Initialize with empty arrays if no data exists
    let projects = [];

    try {
      // Get Storage files
      const [files] = await bucket.getFiles({ prefix: 'projects/' });
      const metadataFiles = files.filter(file => file.name.endsWith('/metadata.json'));
      
      // Get Firestore data (won't throw if collection doesn't exist)
      const firestoreProjects = await req.projectService.getAllProjects(companyName) || [];
      const firestoreMap = new Map(
        firestoreProjects.map(p => [p.id, p])
      );
      
      projects = await Promise.all(
        metadataFiles.map(async (file) => {
          try {
            const [content] = await file.download();
            const storageProject = JSON.parse(content.toString());
            const firestoreData = firestoreMap.get(storageProject.id);
            
            return {
              ...storageProject,
              executiveSummary: firestoreData?.executiveSummary || null,
              analyses: firestoreData?.analyses || {},
              aiAnalysis: firestoreData?.aiAnalysis || null,
              bidStatus: firestoreData?.bidStatus || storageProject.bidStatus || 'pending',
              updatedAt: firestoreData?.updatedAt || storageProject.updatedAt || storageProject.createdAt
            };
          } catch (error) {
            console.error(`Error processing project metadata:`, error);
            return null;
          }
        })
      );
    } catch (error) {
      console.error('Error fetching project data:', error);
      // Don't throw, just log the error
    }

    // Filter out any null values and send response
    const validProjects = projects.filter(p => p !== null);
    
    // Only send response once
    return res.json(validProjects);

  } catch (error) {
    // If we hit an error we haven't handled, pass it to error handler
    return next(error);
  }
});


router.get('/projects/:projectId/files', validateCompany, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { bucket } = req.company;
    
    console.log('\n=== File Fetch Request ===');
    console.log('Request details:', {
      projectId,
      company: req.company.name,
      bucketName: bucket.name
    });

    // Changed: Remove bucketPrefix from path construction since bucket is already company-specific
    const storagePath = `projects/${projectId}/files/`;
    console.log('Looking for files in:', storagePath);

    try {
      const [files] = await bucket.getFiles({ prefix: storagePath });
      
      console.log('Files found:', {
        count: files.length,
        paths: files.map(f => f.name)
      });

      const fileList = files
        .filter(file => !file.name.endsWith('metadata.json'))
        .map(file => ({
          fileName: file.name.split('/').pop() || '',
          fileUrl: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
          size: parseInt(file.metadata.size || '0'),
          contentType: file.metadata.contentType || 'application/octet-stream',
          uploadedAt: file.metadata.timeCreated || new Date().toISOString()
        }));

      console.log('Returning file list:', {
        count: fileList.length,
        files: fileList.map(f => f.fileName)
      });

      return res.json(fileList); // Changed: Return fileList directly, not wrapped in object
    } catch (storageError) {
      console.error('Storage error:', {
        error: storageError,
        path: storagePath
      });
      throw storageError;
    }
  } catch (error) {
    console.error('Files endpoint error:', {
      error: error.message,
      projectId: req.params.projectId,
      company: req.params.companyName
    });
    res.status(500).json({
      error: 'Failed to fetch files',
      details: error.message
    });
  }
});


router.get('/projects/:projectId', validateCompany, async (req, res, next) => {
  try {
    const { projectId, companyName } = req.params;  // Get companyName from params
    const { bucket } = req.company;
    
    console.log('Fetching project:', { projectId, companyName, bucket: !!bucket });

    // Get project from Cloud Storage
    const [exists] = await bucket.file(`projects/${projectId}/metadata.json`).exists();
    if (!exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [content] = await bucket.file(`projects/${projectId}/metadata.json`).download();
    const storageProject = JSON.parse(content.toString());

    // Pass companyName explicitly to projectService
    const firestoreProject = await req.projectService.getProject(projectId, companyName);
    
    const enhancedProject = {
      ...storageProject,
      executiveSummary: firestoreProject?.executiveSummary || null,
      analyses: firestoreProject?.analyses || {},
      bidStatus: firestoreProject?.bidStatus || storageProject.bidStatus || 'pending',
      updatedAt: firestoreProject?.updatedAt || storageProject.updatedAt || storageProject.createdAt
    };

    res.json(enhancedProject);
  } catch (error) {
    console.error('Error fetching project:', { 
      error: error.message, 
      projectId: req.params.projectId,
      companyName: req.params.companyName 
    });
    next(error);
  }
});

router.post('/projects', validateCompany, async (req, res, next) => {
  try {
    const { name, organization, rfpNumber } = req.body;
    const { companyName } = req.params;
    
    console.log('Project creation request:', {
      userAuth: !!req.user,
      userEmail: req.user?.email,
      userCompany: req.user?.company,
      headerCompany: req.headers['x-company-name'],
      paramCompany: companyName
    });

        
    if (!name || !organization) {
      return res.status(400).json({ error: 'Name and organization are required' });
    }

    const projectId = uuidv4();
    const project = {
      id: projectId,
      name,
      organization,
      rfpNumber: rfpNumber || '',
      company: companyName,
      bidStatus: 'pending',
      createdAt: new Date().toISOString(),
      files: []
    };

    // Get bucket from validated company middleware
    const { bucket } = req.company;

    // Save to Cloud Storage
    await bucket.file(`projects/${projectId}/metadata.json`)
      .save(JSON.stringify(project, null, 2), {
        contentType: 'application/json'
      });

    try {
      // Create Firestore document
      await req.projectService.createProject(project, companyName);  // Fixed this line
      console.log('Project created in both Storage and Firestore:', projectId);
    } catch (firestoreError) {
      console.error('Firestore error - continuing anyway:', firestoreError);
    
    }

    return res.status(201).json(project);
  } catch (error) {
    console.error('Project creation error:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      company: req.params.companyName
    });
    next(error);
  }
});

router.delete('/projects/:projectId', validateCompany, async (req, res, next) => {
  try {
    const { projectId, companyName } = req.params;

    // Use controller for main deletion
    await projectController.deleteProject(req, res);

    // Additional cleanup if needed
    await req.projectService.deleteProject(req.params.projectId, req.companyName);

    res.status(200).json({
      message: 'Project deleted successfully',
      projectId
    });
  } catch (error) {
    next(error);
  }
});


// Project status management
router.patch('/:projectId/status', async (req, res) => {
  try {
    const { companyName, projectId } = req.params;
    const { status } = req.body;

    console.log('Updating project status:', {
      companyName,
      projectId,
      newStatus: status
    });

    // Get Firestore instance
    const db = admin.firestore();

    // Reference to project document
    const projectRef = db.collection('companies')
      .doc(companyName)
      .collection('projects')
      .doc(projectId);

    // Update the status
    await projectRef.update({
      bidStatus: status,
      lastModified: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: req.user.uid // from your auth middleware
    });

    // If status is 'go', create a proposal
    if (status === 'go') {
      const projectDoc = await projectRef.get();
      const projectData = projectDoc.data();

      // Create proposal
      const proposalData = {
        projectId: projectId,
        projectName: projectData.name,
        organization: projectData.organization,
        category: 'construction',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'draft',
        companyName: companyName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: req.user.uid,
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: req.user.uid
      };

      // Create proposal in Firestore
      const proposalRef = await db.collection('companies')
        .doc(companyName)
        .collection('projects')
        .doc(projectId)
        .collection('proposals')
        .add(proposalData);

      console.log('Created proposal:', proposalRef.id);
    }

    res.json({ 
      message: 'Status updated successfully',
      status,
      projectId
    });

  } catch (error) {
    console.error('Error updating project status:', error);
    res.status(500).json({ 
      error: 'Failed to update project status',
      details: error.message
    });
  }
});

router.post(
  '/projects/:projectId/executive-summary',
  validateCompany,
  geminiController.generateExecutiveSummary  
);

// Add project metadata routes if needed
router.post('/projects/:projectId/metadata', validateCompany, async (req, res, next) => {
  try {
    // Handle metadata updates
    const { projectId, companyName } = req.params;  // Get companyName from params
    const updates = req.body;

    // Update in Firestore
    await req.projectService.updateProject(projectId, updates, companyName);  

    res.json({ message: 'Metadata updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Project Route Error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    company: req.headers['x-company-name']
  });

  if (err.code === 403) {
    return res.status(403).json({
      error: 'Access denied to company project',
      details: err.message
    });
  }

  if (err.code === 404) {
    return res.status(404).json({
      error: 'Project not found',
      details: err.message
    });
  }

  res.status(err.status || 500).json({
    error: 'An error occurred',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

module.exports = router;