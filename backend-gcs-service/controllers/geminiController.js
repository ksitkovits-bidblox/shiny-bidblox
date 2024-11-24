// controllers/geminiController.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Storage } = require('@google-cloud/storage');
const { ProjectService } = require('../services/projectService');
require('dotenv').config();
const { getStoragePath } = require('../utils/storagePaths');

const projectService = new ProjectService();

// Helper function for cache validation
const isCacheValid = (cached, currentFileCount) => {
  const isValid =
    cached &&
    cached.content &&
    typeof cached.fileCount === 'number' &&
    cached.fileCount === currentFileCount &&
    cached.generatedAt;

  console.log('Cache validation check:', {
    hasCachedContent: !!cached?.content,
    cachedFileCount: cached?.fileCount,
    currentFileCount,
    hasGeneratedAt: !!cached?.generatedAt,
    isValid,
  });

  return isValid;
};



// Initialize services 
/*const initializeServices = () => {
  console.log('Current environment variables:', {
    projectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    bucketPrefix: !!process.env.BUCKET_PREFIX,
    geminiKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY)
  });

  const requiredEnvVars = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    bucketName: process.env.BUCKET_PREFIX,
    // Use GEMINI_API_KEY with fallback to GOOGLE_GEMINI_API_KEY
    geminiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
  };

  // Check for missing variables
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('Environment variables status:', {
      'GOOGLE_CLOUD_PROJECT_ID': process.env.GOOGLE_CLOUD_PROJECT_ID || 'missing',
      'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS || 'missing',
      'BUCKET_PREFIX': process.env.BUCKET_PREFIX || 'missing',
      'GEMINI_API_KEY': process.env.GEMINI_API_KEY ? 'set' : 'missing',
      'GOOGLE_GEMINI_API_KEY': process.env.GOOGLE_GEMINI_API_KEY ? 'set' : 'missing'
    });
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  try {
    // Initialize Google Cloud Storage
    const storage = new Storage({
      projectId: requiredEnvVars.projectId,
      keyFilename: requiredEnvVars.credentials
    });

    return {
      storage,
      genAI: new GoogleGenerativeAI(requiredEnvVars.geminiKey)
    };
  } catch (error) {
    console.error('Error initializing services:', error);
    throw error;
  }
};




// Initialize services once
const { storage, genAI } = initializeServices();

// Helper function to get company-specific bucket
const getCompanyBucket = (company) => {
  const sanitizedName = company.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const bucketName = `${process.env.BUCKET_PREFIX}-${sanitizedName}`;
  return storage.bucket(bucketName);
};
*/
const getProjectFiles = async (bucket, company, projectId) => {
  try {
    const exists = await bucket.exists();
    const [files] = await bucket.getFiles({ 
      prefix: `projects/${projectId}/files/` 
    });

    console.log('Bucket access:', {
      company,
      projectId,
      bucketName: bucket.name,
      exists,
      files: files.map(f => f.name)
    });

    // Match the existing file structure
    const prefix = getStoragePath(company, projectId);
    console.log('Looking for files in:', prefix);

    //const [files] = await bucket.getFiles({ prefix });

    if (files.length === 0) {
      console.log('No files found in path:', prefix);
      throw new Error('No files found for this project');
    }

    console.log('Files found:', {
      count: files.length,
      paths: files.map(f => f.name)
    });

    const fileContents = await Promise.all(
      files.filter(file => !file.name.endsWith('metadata.json'))
        .map(async (file) => {
          try {
            const [metadata] = await file.getMetadata();
            const [content] = await file.download();
            return {
              name: file.name,
              content: content.toString('base64'),
              type: metadata.contentType
            };
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            return null;
          }
        })
    );

    const validContents = fileContents.filter(f => f !== null);
    if (validContents.length === 0) {
      throw new Error('No valid content could be extracted from files');
    }

    return { files, validContents, fileCount: files.length };
  } catch (error) {
    console.error('Error in getProjectFiles:', error);
    throw error;
  }
};


exports.generateExecutiveSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { forceRegenerate = false } = req.body;
    const company = req.company.name;
    const bucket = req.company.bucket;

    console.log('Executive summary request:', {
      projectId,
      company,
      bucket: bucket.name,
      forceRegenerate
    });

    // Get project from Firestore first for cache checking
    const project = await projectService.getProject(projectId, company);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get current files
    const { files, validContents, fileCount } = await getProjectFiles(bucket, company, projectId);

    // Enhanced cache checking
    console.log('Executive summary cache status:', {
      hasCache: !!project.executiveSummary,
      cachedFileCount: project.executiveSummary?.fileCount,
      currentFileCount: fileCount,
      forceRegenerate
    });

    // Return cached version if valid
    if (!forceRegenerate && 
        project.executiveSummary?.content && 
        project.executiveSummary.fileCount === fileCount) {
      console.log('Returning cached executive summary');
      return res.status(200).json({
        analysis: project.executiveSummary.content,
        generatedAt: project.executiveSummary.generatedAt,
        wasRegenerated: false,
        fileCount
      });
    }

    const { genAI } = req.app.locals.services;
    
    console.log('Generating new executive summary:', {
      reason: forceRegenerate ? 'Force regenerate' : 'Cache invalid',
      fileCount,
      modelType: 'gemini-1.5-flash'
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    
    const executiveSummaryPrompt = `You are a chat with PDF bot. User will upload their own PDFs and your job is to answer user's queries based on the files that the user has provided and to summarize the pdf.

# Executive Summary

Using the files provided, begin with a brief overview paragraph of the overall RFP. Site and building information is important.

## Key Points

* List the most important aspects like project scope
* Include site description, site location, size
* Expected property and land size

## Timeline Overview

* Key deadlines, final submission dates for RFP response (extract dates on addendums), and deliverables

## Additional Information
* Include important information such as evaluation, submission rules, budget, pricing requirements only if they are in the document.

Please use proper markdown formatting with paragraphs, bullet points, and clear section headers.`;

    const contents = [{
      role: 'user',
      parts: [
        { text: executiveSummaryPrompt },
        ...validContents.map(file => ({
          inline_data: {
            mime_type: file.type,
            data: file.content
          }
        }))
      ]
    }];

    const result = await model.generateContent({ contents });
    const summary = result.response.text();
    const generatedAt = new Date().toISOString();

    // Save to Firestore
    const summaryData = {
      content: summary,
      generatedAt,
      fileCount,
      lastUpdated: new Date().toISOString()
    };


    await projectService.updateExecutiveSummary(projectId, summaryData, company);

    console.log('Executive summary generation complete:', {
      fileCount,
      contentLength: summary.length,
      generatedAt
    });

    res.status(200).json({
      analysis: summary,
      generatedAt,
      wasRegenerated: true,
      fileCount
    });

  } catch (error) {
    console.error('Executive summary error:', {
      error: error.message,
      stack: error.stack,
      projectId: req.params.projectId,
      company: req.company?.name
    });
    res.status(500).json({
      error: 'Failed to generate executive summary',
      details: error.message
    });
  }
};

exports.analyzeProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { prompt, questionId, forceRegenerate = false } = req.body;
    const company = req.company.name;
    const bucket = req.company.bucket;

    console.log('Analysis request:', {
      projectId,
      company,
      bucket: bucket.name,
      forceRegenerate
    });

    // Get project from Firestore first for cache checking
    const project = await projectService.getProject(projectId, company);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get current files
    const { files, validContents, fileCount } = await getProjectFiles(bucket, company, projectId);

    // Generate analysis using Gemini
    const { genAI } = req.app.locals.services;
    console.log('Generating analysis:', {
      questionId,
      fileCount,
      modelType: 'gemini-1.5-flash'
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const contents = [{
      role: 'user',
      parts: [
        { text: prompt },
        ...validContents.map(file => ({
          inline_data: {
            mime_type: file.type,
            data: file.content
          }
        }))
      ]
    }];

    const result = await model.generateContent({ contents });
    const analysisContent = result.response.text();
    const generatedAt = new Date().toISOString();

    // Save to Firestore
    const analysisData = {
      content: analysisContent,
      generatedAt,
      fileCount,
      lastUpdated: new Date().toISOString()
    };

    await projectService.updateAnalysis(projectId, questionId, analysisData, company);

    console.log('Analysis generation complete:', {
      fileCount,
      contentLength: analysisContent.length,
      generatedAt
    });

    res.status(200).json({
      analysis: analysisContent,
      generatedAt,
      wasRegenerated: true,
      fileCount
    });

  } catch (error) {
    console.error('Analysis error:', {
      error: error.message,
      stack: error.stack,
      projectId: req.params.projectId,
      company: req.company?.name
    });
    res.status(500).json({
      error: 'Failed to analyze project',
      details: error.message
    });
  }
};



// Keep the existing getProjectFiles helper function
/**
 * Updates a specific analysis in the project document
 * @param {string} projectId - The ID of the project
 * @param {string} questionId - The ID of the analysis question
 * @param {Analysis} analysisData - The analysis data to update
 * @returns {Promise<void>}
 */
exports.updateAnalysis = async (projectId, questionId, analysisData) => {
  try {
    const projectRef = admin.firestore().collection('projects').doc(projectId);
    
    // Create the update object with the correct path to the specific analysis
    const updateData = {
      [`analyses.${questionId}`]: {
        content: analysisData.content,
        generatedAt: analysisData.generatedAt || new Date().toISOString(),
        fileCount: analysisData.fileCount
      },
      updatedAt: new Date().toISOString()  // Using updatedAt instead of lastUpdated to match Project type
    };

    // Use set with merge to update the specific analysis
    await projectRef.set(updateData, { merge: true });

    console.log('Analysis updated successfully:', {
      projectId,
      questionId,
      fileCount: analysisData.fileCount,
      timestamp: analysisData.generatedAt
    });
  } catch (error) {
    console.error('Error updating analysis:', error);
    throw error;
  }

  module.exports = {
    analyzeProject,
    generateExecutiveSummary: require('./executiveSummary'),
  };
};