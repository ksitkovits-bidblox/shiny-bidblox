// controllers/storageController.js
require('dotenv').config();
const { Storage } = require('@google-cloud/storage');
const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
//const { db } = require('../config/firebase');
const path = require('path');
const { createReadStream } = require('fs');





// Initialize Firebase Admin only if not already initialized
let firebaseApp;
if (getApps().length === 0) {
  firebaseApp = initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
  });
} else {
  firebaseApp = getApps()[0];
}

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Helper function to get bucket name from company
const getBucketName = (company) => {
  const sanitizedName = company.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${process.env.BUCKET_PREFIX}-${sanitizedName}`;
};


// Helper function to ensure company bucket exists
const ensureCompanyBucket = async (company) => {
  const bucketName = getBucketName(company);
  const bucket = storage.bucket(bucketName);
  
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log(`Creating new bucket: ${bucketName}`);
      await storage.createBucket(bucketName);
      // Set uniform bucket-level access
      await bucket.setIamPolicy({
        bindings: [
          {
            role: 'roles/storage.objectViewer',
            members: ['serviceAccount:' + process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT]
          }
        ]
      });
    }
    return bucket;
  } catch (error) {
    console.error(`Error ensuring bucket for ${company}:`, error);
    throw error;
  }
};

// Middleware to verify user's company access
exports.verifyCompanyAccess = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const userCompany = userData.companyName;

    const requestedCompany = req.params.companyName;
    if (requestedCompany !== userCompany) {
      return res.status(403).json({ 
        error: 'You do not have access to this company\'s resources' 
      });
    }

    req.user = {
      uid,
      company: userCompany,
      ...userData
    };

    next();
  } catch (error) {
    console.error('Error verifying company access:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const { company } = req.user;
    console.log(`Fetching projects for company: ${company}`);

    const bucket = await ensureCompanyBucket(company);
    const [files] = await bucket.getFiles({ prefix: 'projects/' });
    
    const metadataFiles = files.filter(file => file.name.endsWith('/metadata.json'));
    console.log(`Found ${metadataFiles.length} project metadata files`);

    const projects = await Promise.all(
      metadataFiles.map(async (file) => {
        try {
          const [content] = await file.download();
          const projectData = JSON.parse(content.toString());
          
          // Ensure all required fields are present
          return {
            id: projectData.id,
            name: projectData.name,
            organization: projectData.organization,
            rfpNumber: projectData.rfpNumber || '', // Provide default for older projects
            company: projectData.company,
            createdBy: projectData.createdBy,
            bidStatus: projectData.bidStatus || 'pending',
            createdAt: projectData.createdAt,
            files: projectData.files || []
          };
        } catch (error) {
          console.error(`Error processing project metadata file ${file.name}:`, error);
          return null;
        }
      })
    );

    // Filter out any null values from failed processing
    const validProjects = projects.filter(project => project !== null);
    console.log(`Successfully retrieved ${validProjects.length} projects`);

    res.status(200).json(validProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

exports.getProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { company } = req.user;
    console.log(`Fetching project ${projectId} for company ${company}`);

    const bucket = await ensureCompanyBucket(company);
    const metadataFile = bucket.file(`projects/${projectId}/metadata.json`);
    
    const [exists] = await metadataFile.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [content] = await metadataFile.download();
    const projectData = JSON.parse(content.toString());
    
    // Ensure consistent data structure
    const project = {
      id: projectData.id,
      name: projectData.name,
      organization: projectData.organization,
      rfpNumber: projectData.rfpNumber || '', // Provide default for older projects
      company: projectData.company,
      createdBy: projectData.createdBy,
      bidStatus: projectData.bidStatus || 'pending',
      createdAt: projectData.createdAt,
      files: projectData.files || []
    };

    res.status(200).json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

exports.createProject = async (req, res) => {
  try {
    // Log the entire request body first
    console.log('Raw request body:', req.body);

    const { name, organization, rfpNumber } = req.body;
    const { company, uid } = req.user;
    
    // Log the destructured values
    console.log('Destructured values:', {
      name,
      organization,
      rfpNumber,
      company,
      uid
    });
    
    if (!name || !organization || !rfpNumber) {
      console.log('Validation failed:', { name, organization, rfpNumber });
      return res.status(400).json({ 
        error: 'Name, organization, and RFP number are required' 
      });
    }

    const bucket = await ensureCompanyBucket(company);
    const projectId = require('crypto').randomUUID();
    
    // Log values just before creating project object
    console.log('Values before project creation:', {
      name,
      organization,
      rfpNumber,
      company,
      uid
    });

    const project = {
      id: projectId,
      name,
      organization,
      rfpNumber: rfpNumber || '',  // Add default value
      company,
      createdBy: uid,
      bidStatus: 'pending',
      createdAt: new Date().toISOString(),
      files: []
    };

    // Log the project object
    console.log('Project object created:', project);

    const metadataFile = bucket.file(`projects/${projectId}/metadata.json`);
    await metadataFile.save(JSON.stringify(project, null, 2), {
      contentType: 'application/json'
    });

    // Log before Firestore save
    console.log('Saving to Firestore:', {
      id: projectId,
      name,
      rfpNumber,
      organization,
      createdAt: new Date(),
      createdBy: uid
    });

    await db.collection('companies').doc(company)
      .collection('projects').doc(projectId)
      .set({
        id: projectId,
        name,
        rfpNumber,
        organization,
        createdAt: new Date(),
        createdBy: uid
      });

    // Log response before sending
    console.log('Sending response:', project);
    
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { company } = req.user;
    
    const bucket = await ensureCompanyBucket(company);
    const metadataFile = bucket.file(`projects/${projectId}/metadata.json`);
    
    const [exists] = await metadataFile.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [files] = await bucket.getFiles({
      prefix: `projects/${projectId}/`
    });

    if (files.length > 0) {
      await Promise.all(files.map(file => file.delete()));
    }

    // Delete project from Firestore
    await db.collection('companies').doc(company)
      .collection('projects').doc(projectId)
      .delete();

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

exports.uploadFiles = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  // Validate using company from params instead of req.user
  const company = req.params.companyName
  if (!company || !req.user?.uid) {
    return res.status(401).json({ error: 'Missing company or user details.' });
  }

  try {
    const { projectId } = req.params;
    const bucket = await ensureCompanyBucket(company);
    
    const uploadedFiles = await Promise.all(req.files.map(async (file) => {
      // Add timestamp to prevent naming conflicts
      const safeFileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const destinationPath = `projects/${projectId}/files/${safeFileName}`;
      const blob = bucket.file(destinationPath);
      
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: file.mimetype,
        metadata: {
          contentType: file.mimetype,
          originalname: file.originalname,
          uploadedBy: req.user.uid
        }
      });

      // Use createReadStream directly from import
      await new Promise((resolve, reject) => {
        const readStream = createReadStream(file.path);
        readStream
          .pipe(blobStream)
          .on('error', (error) => {
            console.error('Stream error:', error);
            reject(error);
          })
          .on('finish', () => {
            console.log('Stream finished for:', file.originalname);
            resolve();
          });
      });

      return {
        fileName: safeFileName,
        fileUrl: `https://storage.googleapis.com/${getBucketName(company)}/${destinationPath}`,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: req.user.uid,
        uploadedAt: new Date().toISOString()
      };
    }));

    // Update metadata
    const metadataFile = bucket.file(`projects/${projectId}/metadata.json`);
    let projectMetadata;
    try {
      const [content] = await metadataFile.download();
      projectMetadata = JSON.parse(content.toString());
    } catch (error) {
      // Initialize metadata if it doesn't exist
      projectMetadata = { files: [] };
    }
    
    projectMetadata.files = [...projectMetadata.files, ...uploadedFiles];
    
    await metadataFile.save(JSON.stringify(projectMetadata, null, 2), {
      contentType: 'application/json'
    });

    console.log('Upload completed successfully');
    res.status(200).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Error in upload process:', error);
    res.status(500).json({ error: error.message });
  }
};


exports.getFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { company } = req;

    console.log('\n=== File Fetch Request ===');
    console.log('Request details:', {
      projectId,
      company: company.name,
      bucketName: company.bucketName
    });
    
    const bucket = await ensureCompanyBucket(company);
    
    // Match the frontend path structure
    const storagePath = `companies/company-${company.name}/projects/${projectId}/`;
    
    console.log('Looking for files in storage path:', storagePath);

    const [files] = await bucket.getFiles({ 
      prefix: storagePath
    });

    console.log('Files found:', {
      count: files.length,
      paths: files.map(f => f.name)
    });

    const fileList = files.map(file => ({
      fileName: file.name.split('/').pop(),  // Get just the filename
      fileUrl: file.publicUrl(),
      size: parseInt(file.metadata.size),
      contentType: file.metadata.contentType,
      uploadedAt: file.metadata.timeCreated
    }));

    console.log('Returning file list:', {
      count: fileList.length,
      files: fileList.map(f => ({
        name: f.fileName,
        size: f.size
      }))
    });

    res.status(200).json(fileList);
  } catch (error) {
    console.error('Error getting files:', {
      error: error.message,
      projectId: req.params.projectId,
      company: req.company?.name
    });
    res.status(500).json({ error: error.message });
  }
};

exports.downloadFile = async (req, res) => {
  console.log('\n=== Download File Request ===');
  console.log('Request details:', {
    params: req.params,
    user: req.user,
    path: req.path
  });

  try {
    const { projectId, fileName } = req.params;
    
    // Get the storage service from app.locals
    const { getStorageBucket } = req.app.locals.services;
    
    if (!req.user?.email) {
      console.error('User email missing');
      return res.status(400).json({ error: 'User email is required' });
    }

    // Use the centralized bucket getter
    const bucket = getStorageBucket(req.user.email);
    console.log('Using bucket:', { 
      bucketName: bucket.name,
      userEmail: req.user.email 
    });

    // Construct the file path
    const filePath = projectId ? `projects/${projectId}/files/${fileName}` : fileName;
    console.log('Attempting to download file:', { filePath, bucket: bucket.name });

    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.log('File not found:', { filePath, bucket: bucket.name });
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();
    
    // Set appropriate headers for the download
    res.setHeader('Content-Type', metadata.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', metadata.size);

    // Stream the file to the response
    const readStream = file.createReadStream();
    
    readStream
      .on('error', (error) => {
        console.error('Error streaming file:', error);
        // Only send error if headers haven't been sent
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Error downloading file',
            details: error.message
          });
        }
      })
      .pipe(res)
      .on('finish', () => {
        console.log('File download completed successfully:', {
          fileName,
          size: metadata.size,
          contentType: metadata.contentType
        });
      });

  } catch (error) {
    console.error('Error setting up file download:', {
      error: error.message,
      stack: error.stack,
      params: req.params,
      userEmail: req.user?.email
    });
    
    // Only send error if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to download file',
        details: error.message
      });
    }
  }
};

// Add a helper function to handle range requests if needed
exports.streamFile = async (req, res) => {
  console.log('\n=== Stream File Request ===');
  try {
    const { projectId, fileName } = req.params;
    const { getStorageBucket } = req.app.locals.services;
    
    if (!req.user?.email) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const bucket = getStorageBucket(req.user.email);
    const filePath = projectId ? `projects/${projectId}/files/${fileName}` : fileName;
    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const [metadata] = await file.getMetadata();
    const fileSize = metadata.size;

    // Handle range requests
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': metadata.contentType
      });

      file.createReadStream({ start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': metadata.contentType
      });
      file.createReadStream().pipe(res);
    }
  } catch (error) {
    console.error('Streaming error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file' });
    }
  }
};

exports.deleteFile = async (req, res) => {
  console.log('\n=== Delete File Request ===');
  console.log('Request details:', {
    params: req.params,
    company: req.company,
    user: req.user,
    path: req.path
  });

  try {
    const { projectId, fileName } = req.params;
    
    // Get the storage service from app.locals
    const { storage, getStorageBucket } = req.app.locals.services;
    
    if (!req.user?.email) {
      console.error('User email missing');
      return res.status(400).json({ error: 'User email is required' });
    }

    // Use the centralized bucket getter
    const bucket = getStorageBucket(req.user.email);
    console.log('Using bucket:', { 
      bucketName: bucket.name,
      userEmail: req.user.email 
    });

    // Construct the file path
    const filePath = projectId ? `projects/${projectId}/files/${fileName}` : fileName;
    console.log('Attempting to delete file:', { filePath, bucket: bucket.name });

    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.log('File not found:', { filePath, bucket: bucket.name });
      return res.status(404).json({ error: 'File not found' });
    }

    await file.delete();
    console.log('File deleted successfully:', { filePath, bucket: bucket.name });

    res.status(200).json({ 
      message: `File ${fileName} deleted successfully` 
    });
  } catch (error) {
    console.error('Error deleting file:', {
      error: error.message,
      stack: error.stack,
      params: req.params,
      userEmail: req.user?.email
    });
    
    res.status(500).json({ 
      error: 'Failed to delete file',
      details: error.message
    });
  }
};


exports.updateProjectMetadata = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { company, uid } = req.user;
    const updateData = req.body;
    
    const bucket = await ensureCompanyBucket(company);
    const metadataFile = bucket.file(`projects/${projectId}/metadata.json`);
    
    // Get current metadata
    let currentMetadata;
    try {
      const [content] = await metadataFile.download();
      currentMetadata = JSON.parse(content.toString());
    } catch (error) {
      // Initialize default metadata if file doesn't exist
      currentMetadata = { 
        files: [],
        bidStatus: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: uid
      };
    }

    // Handle different types of updates
    if (updateData.bidStatus) {
      // Validate bid status
      const validStatuses = ['go', 'no-go', 'pending'];
      if (!validStatuses.includes(updateData.bidStatus)) {
        return res.status(400).json({ 
          error: 'Invalid bid status',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }
      
      // Update bid status and related metadata
      currentMetadata.bidStatus = updateData.bidStatus;
      currentMetadata.lastStatusUpdate = new Date().toISOString();
      currentMetadata.lastStatusUpdateBy = uid;
    } else if (Array.isArray(updateData)) {
      // Handle file metadata updates
      currentMetadata.files = currentMetadata.files.concat(updateData);
    } else {
      // Handle other metadata updates
      Object.assign(currentMetadata, updateData);
    }

    // Always update the updatedAt and updatedBy fields
    currentMetadata.updatedAt = new Date().toISOString();
    currentMetadata.updatedBy = uid;

    // Save updated metadata
    await metadataFile.save(JSON.stringify(currentMetadata, null, 2), {
      contentType: 'application/json'
    });

    // Return the updated project data
    res.status(200).json(currentMetadata);
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({ 
      error: 'Failed to update metadata',
      message: error.message 
    });
  }
};

exports.sendToGemini = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { company } = req.user;
    const { content, questionId } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required for analysis' });
    }

    // Get the project metadata first
    const bucket = await ensureCompanyBucket(company);
    const metadataFile = bucket.file(`projects/${projectId}/metadata.json`);

    const [exists] = await metadataFile.exists();
    if (!exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get current files count from metadata
    const [metadataContent] = await metadataFile.download();
    const metadata = JSON.parse(metadataContent.toString());
    const fileCount = (metadata.files || []).length;

    // Get Gemini from app.locals.services
    const genAI = req.app.locals.services.genAI;
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Generate the analysis
    const result = await model.generateContent(content);
    const response = await result.response;
    
    // Prepare analysis data
    const analysisData = {
      content: response.text(),
      generatedAt: new Date().toISOString(),
      fileCount: req.body.fileCount || fileCount
    };

    // Update Firestore using ProjectService
    const { projectService } = require('../services/projectService');
    await projectService.updateAnalysis(projectId, questionId, analysisData, company);

    // Also update the Cloud Storage metadata to keep them in sync
    metadata.analyses = metadata.analyses || {};
    metadata.analyses[questionId] = analysisData;
    metadata.updatedAt = new Date().toISOString();

    await metadataFile.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json'
    });

    res.status(200).json(analysisData);
  } catch (error) {
    console.error('Error in Gemini analysis:', error);
    res.status(500).json({ 
      error: 'Failed to analyze with Gemini',
      message: error.message 
    });
  }
};