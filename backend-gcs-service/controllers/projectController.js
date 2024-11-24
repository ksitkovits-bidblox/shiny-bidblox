// controllers/projectController.js
require('dotenv').config();
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const projectService = require('../services/projectService');

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

// Ensure company bucket exists
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

exports.getProjects = async (req, res) => {
  try {
    // Get bucket from company validation middleware
    const { bucket } = req.company;
    
    // Log bucket access attempt
    console.log('Accessing bucket:', {
      company: req.company.name,
      prefix: `projects/`,
      bucketName: req.company.bucketName
    });

    // Get all files in the projects directory
    const [files] = await bucket.getFiles({ 
      prefix: 'projects/'
    });
    
    // Filter for metadata files and parse them
    const metadataFiles = files.filter(file => file.name.endsWith('/metadata.json'));
    console.log(`Found ${metadataFiles.length} project metadata files`);

    const projects = await Promise.all(
      metadataFiles.map(async (file) => {
        try {
          const [content] = await file.download();
          const projectData = JSON.parse(content.toString());
          
          return {
            ...projectData,
            updatedAt: file.metadata.updated,
            size: file.metadata.size,
            projectPath: file.name.replace('/metadata.json', '')
          };
        } catch (error) {
          console.error(`Error processing project file ${file.name}:`, error);
          return null;
        }
      })
    );

    const validProjects = projects.filter(project => project !== null);
    res.status(200).json(validProjects);

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ 
      error: 'Failed to fetch projects',
      details: error.message
    });
  }
};





// Get single project
exports.getProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { bucket } = req.company;
    
    const [content] = await bucket.file(`projects/${projectId}/metadata.json`).download();
    const storageProject = JSON.parse(content.toString());
    const firestoreProject = await projectService.getProject(projectId);
    
    res.status(200).json({
      ...storageProject,
      aiAnalysis: firestoreProject?.aiAnalysis
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};


// Create new project
exports.createProject = async (req, res) => {
  try {
    const { name, organization, rfpNumber } = req.body;
    const { bucket, name: companyName } = req.company;
    
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

    await bucket.file(`projects/${projectId}/metadata.json`)
      .save(JSON.stringify(project, null, 2), {
        contentType: 'application/json'
      });

    await projectService.createProject({
      ...project,
      aiAnalysis: null
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};


// Update project status
exports.updateProjectStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status } = req.body;
    const { bucket } = req.company;

    const metadataFile = bucket.file(`projects/${projectId}/metadata.json`);
    const [content] = await metadataFile.download();
    const project = JSON.parse(content.toString());

    const updatedProject = {
      ...project,
      bidStatus: status,
      updatedAt: new Date().toISOString()
    };

    await metadataFile.save(JSON.stringify(updatedProject, null, 2));
    await projectService.updateProject(projectId, {
      bidStatus: status,
      updatedAt: updatedProject.updatedAt
    });

    res.status(200).json(updatedProject);
  } catch (error) {
    console.error('Error updating project status:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
};

// Bucket cleanup
const cleanupEmptyBucket = async (company) => {
  try {
    const bucket = await ensureCompanyBucket(company);
    const [files] = await bucket.getFiles();
    
    if (files.length === 0) {
      console.log(`Cleaning up empty bucket for company: ${company}`);
      await bucket.delete();
    }
  } catch (error) {
    console.error(`Error cleaning up bucket for ${company}:`, error);
    // Don't throw error as this is a cleanup operation
  }
};


// Delete project

exports.deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { bucket, name: companyName } = req.company;

    const [files] = await bucket.getFiles({
      prefix: `projects/${projectId}/`
    });

    await Promise.all(files.map(file => file.delete()));
    await projectService.deleteProject(projectId, companyName);

    res.status(200).json({ 
      message: 'Project deleted successfully',
      projectId
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

