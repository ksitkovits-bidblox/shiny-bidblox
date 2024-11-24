// controllers/vertexController.js
const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');
const projectService = require('../services/projectService');

// Initialize services
const initializeServices = () => {
  const requiredEnvVars = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME,
    location: process.env.VERTEX_AI_LOCATION || 'us-central1'  // Default to us-central1
  };

  // Log current state
  console.log('Initializing Vertex AI services:', {
    projectId: !!requiredEnvVars.projectId,
    credentials: !!requiredEnvVars.credentials,
    bucketName: !!requiredEnvVars.bucketName,
    location: requiredEnvVars.location
  });

  // Check for missing variables
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  try {
    // Initialize Google Cloud Storage
    const storage = new Storage({
      projectId: requiredEnvVars.projectId,
      keyFilename: requiredEnvVars.credentials
    });

    // Initialize Vertex AI
    const vertexAI = new VertexAI({
      project: requiredEnvVars.projectId,
      location: requiredEnvVars.location
    });

    return {
      bucket: storage.bucket(requiredEnvVars.bucketName),
      vertexAI: vertexAI
    };
  } catch (error) {
    console.error('Error initializing Vertex AI services:', error);
    throw error;
  }
};

// Initialize services once
const { bucket, vertexAI } = initializeServices();

// Reuse the helper functions from the original controller
const isCacheValid = (cached, currentFileCount) => {
  const isValid = cached && 
         cached.content && 
         typeof cached.fileCount === 'number' &&
         cached.fileCount === currentFileCount &&
         cached.generatedAt;

  console.log('Cache validation check:', {
    hasCachedContent: !!cached?.content,
    cachedFileCount: cached?.fileCount,
    currentFileCount,
    hasGeneratedAt: !!cached?.generatedAt,
    isValid
  });

  return isValid;
};

const getProjectFiles = async (projectId) => {
  const [files] = await bucket.getFiles({
    prefix: `projects/${projectId}/files/`
  });

  if (files.length === 0) {
    throw new Error('No files found for this project');
  }

  const fileContents = await Promise.all(
    files.map(async (file) => {
      try {
        const [metadata] = await file.getMetadata();
        const [content] = await file.download();
        return {
          name: file.name,
          content: content.toString('utf-8'), // Changed from base64 to utf-8 for Vertex AI
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
};

exports.generateExecutiveSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { forceRegenerate = false } = req.body;
    
    console.log('Executive summary request:', { projectId, forceRegenerate });

    // Check project existence
    const project = await projectService.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get current file count
    const { files, validContents, fileCount } = await getProjectFiles(projectId);

    // Check cache unless forcing regeneration
    if (!forceRegenerate && isCacheValid(project.executiveSummary, fileCount)) {
      console.log('Returning cached executive summary');
      return res.status(200).json({
        analysis: project.executiveSummary.content,
        generatedAt: project.executiveSummary.generatedAt,
        wasRegenerated: false,
        fileCount
      });
    }

    console.log('Generating new executive summary with Vertex AI');

    // Initialize the model
    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-pro',
      generation_config: {
        max_output_tokens: 2048,
        temperature: 0.4,
        top_p: 0.8,
        top_k: 40
      }
    });

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

Please use proper markdown formatting with paragraphs, bullet points, and clear section headers.

Documents content:
${validContents.map(file => file.content).join('\n\n')}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: executiveSummaryPrompt }] }]
    });

    const summary = result.response.text();
    const generatedAt = new Date().toISOString();

    // Save to Firestore
    const summaryData = {
      content: summary,
      generatedAt,
      fileCount,
      lastUpdated: new Date().toISOString()
    };

    await projectService.updateExecutiveSummary(projectId, summaryData);

    console.log('Executive summary generation complete:', {
      fileCount,
      generatedAt
    });

    res.status(200).json({
      analysis: summary,
      generatedAt,
      wasRegenerated: true,
      fileCount
    });

  } catch (error) {
    console.error('Executive summary error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to generate executive summary'
    });
  }
};

exports.analyzeProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { prompt, questionId, forceRegenerate = false } = req.body;

    console.log('Analysis request:', {
      projectId,
      questionId,
      forceRegenerate
    });

    // Check project and existing analysis
    const project = await projectService.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existingAnalysis = await projectService.getAnalysis(projectId, questionId);
    
    if (existingAnalysis?.content && !forceRegenerate) {
      console.log('Using cached analysis for:', questionId);
      return res.status(200).json({
        analysis: existingAnalysis.content,
        generatedAt: existingAnalysis.generatedAt,
        wasRegenerated: false,
        fileCount: existingAnalysis.fileCount
      });
    }

    const { files, validContents, fileCount } = await getProjectFiles(projectId);

    // Initialize the model
    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-pro',
      generation_config: {
        max_output_tokens: 2048,
        temperature: 0.4,
        top_p: 0.8,
        top_k: 40
      }
    });

    const analysisPrompt = `${prompt}\n\nDocuments content:\n${validContents.map(file => file.content).join('\n\n')}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }]
    });

    const analysisContent = result.response.text();
    const generatedAt = new Date().toISOString();

    // Save the new analysis
    const updatedAnalysis = await projectService.updateAnalysis(
      projectId,
      questionId,
      {
        content: analysisContent,
        generatedAt,
        fileCount
      }
    );

    console.log('Analysis generation complete:', {
      questionId,
      success: true,
      contentLength: analysisContent.length
    });

    return res.status(200).json({
      analysis: analysisContent,
      generatedAt,
      wasRegenerated: true,
      fileCount
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: error.message || 'Unknown error',
      details: 'Failed to analyze project'
    });
  }
};