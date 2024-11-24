const express = require('express');
const router = express.Router({ mergeParams: true }); 
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Storage } = require('@google-cloud/storage');
//const { db, storage } = require('../config/firebase');
const pdfParse = require('pdf-parse');
const ProposalService = require('../services/proposalService');
const { validateCompany } = require('../middleware/companyValidation');




// Initialize ProposalService once for the router
let proposalService;

// Initialization middleware
router.use((req, res, next) => {
  try {
    if (!proposalService) {
      proposalService = new ProposalService();
      console.log('ProposalService initialized in routes');
    }
    req.proposalService = proposalService;
    next();
  } catch (error) {
    console.error('Failed to initialize ProposalService:', error);
    next(error);
  }
});

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n=== New Request ===`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  if (req.method === 'POST' || req.method === 'PATCH') {
    console.log('Body:', req.body);
  }
  console.log(`=================\n`);
  next();
});


/// Get services from app locals
const getServices = (req) => {
  return {
    storage: req.app.locals.services.storage,
    genAI: req.app.locals.services.genAI,
    db: req.projectService.db  // Get Firestore from the service
  };
};

// Get all proposals
router.get('/', validateCompany, async (req, res) => {
  try {
    const { companyName } = req.params;
    const proposals = await proposalService.getAllProposals(companyName);
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});


// Get single proposal
router.get('/:proposalId', validateCompany, async (req, res) => {
  try {
    const { companyName, proposalId } = req.params;
    
    console.log('Getting proposal:', {
      companyName,
      proposalId,
      path: `/companies/${companyName}/proposals/${proposalId}`
    });

    if (!proposalId) {
      return res.status(400).json({ 
        error: 'Proposal ID is required' 
      });
    }

    const proposal = await proposalService.getProposal(companyName, proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(proposal);
  } catch (error) {
    console.error('Error getting proposal:', error);
    res.status(500).json({ 
      error: 'Failed to fetch proposal',
      details: error.message 
    });
  }
});

// Create proposal - single endpoint
router.post('/', validateCompany, async (req, res) => {
  try {
    const { companyName } = req.params;
    if (!companyName) {
      return res.status(400).json({ 
        error: 'Company name is required',
        details: 'Please provide company name in X-Company-Name header'
      });
    }

    // Preserve the existing data structure
    const proposalData = {
      ...req.body,
      companyName // Ensure companyName is included in the data
    };
    
    console.log('Creating proposal:', {
      companyName,
      data: proposalData
    });

    const proposal = await proposalService.createProposal(proposalData);
    res.status(201).json(proposal);
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({
      error: 'Failed to create proposal',
      details: error.message
    });
  }
});

router.patch('/:proposalId', validateCompany, async (req, res) => {
  try {
    const { companyName, proposalId } = req.params;
    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    console.log('Updating proposal:', {
      companyName,
      proposalId,
      updateData: req.body,
      path: `/companies/${companyName}/proposals/${proposalId}`
    });

    const proposal = await proposalService.updateProposal(companyName, proposalId, req.body);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    res.json(proposal);
  } catch (error) {
    console.error('Error updating proposal:', error);
    res.status(500).json({
      error: 'Failed to update proposal',
      details: error.message
    });
  }
});


router.delete('/:proposalId', validateCompany, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { name: companyName } = req.company; // From your company validation middleware

    console.log('Delete request:', {
      proposalId,
      companyName,
      path: req.path,
      fullUrl: req.originalUrl
    });

    // Call service to delete the proposal
    await proposalService.deleteProposal(companyName, proposalId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete proposal error:', error);
    res.status(500).json({ error: error.message });
  }
});


router.get('/:proposalId/draft', validateCompany, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const companyName = req.params.companyName; // This is likely missing or undefined
    
    console.log('Fetching draft:', { proposalId, companyName });
    
    // The companyName should come from the validateCompany middleware
    const draft = await req.proposalService.getDraft(proposalId, req.companyName);
    
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    res.json(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    res.status(500).json({ error: error.message });
  }
});


// In proposalRoutes.js
router.get('/:proposalId/checklist', validateCompany, async (req, res) => {
  try {
    const { companyName } = req.params;
    const { proposalId } = req.params;
    console.log('Fetching checklist for proposal:', proposalId);
    
    const checklist = await proposalService.getChecklist(companyName, proposalId);
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    res.json(checklist);
  } catch (error) {
    console.error('Error fetching checklist:', error);
    res.status(500).json({ 
      error: 'Failed to fetch checklist',
      details: error.message 
    });
  }
});

router.patch('/:proposalId/checklist/items/:itemId', validateCompany, async (req, res) => {
  try {
    const { companyName } = req.params;
    const { proposalId, itemId } = req.params;
    const { completed } = req.body;

    console.log('Updating checklist item:', {
      proposalId,
      itemId,
      completed
    });

    const checklistRef = req.app.locals.services.admin.firestore()
    .collection('companies')
    .doc(companyName)
    .collection('proposals')
    .doc(proposalId)
    .collection('checklists')
    .doc('main');
    const checklistDoc = await checklistRef.get();

    if (!checklistDoc.exists) {
      console.log('Checklist not found:', proposalId);
      return res.status(404).json({ error: 'Checklist not found' });
    }

    const checklist = checklistDoc.data();
    
    const updatedItems = checklist.items.map(item => {
      if (item.id === itemId) {
        return { ...item, completed };
      }
      return item;
    });

    if (!updatedItems.some(item => item.id === itemId)) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    const updatedChecklist = {
      ...checklist,
      items: updatedItems,
      lastUpdated: new Date().toISOString()
    };

    await checklistRef.set(updatedChecklist);
    res.json(updatedChecklist);
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

const retryOperation = async (operation, maxRetries = 3, delay = 2000) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          // Increase delay for next attempt
          delay *= 2;
        }
      }
    }
    
    throw lastError;
  };


  // Add rate limiting helper
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 60000; // 60 seconds between requests

const rateLimitedRequest = async (operation) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`Rate limiting: waiting ${waitTime}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
  return operation();
};

// Function to summarize content
const summarizeContent = (content, maxLength = 30000) => {
    if (content.length <= maxLength) return content;
    
    // Split into sections based on file markers
    const sections = content.split('===');
    let summary = '';
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      // Take first and last parts of each section
      const lines = section.trim().split('\n');
      const firstPart = lines.slice(0, Math.floor(lines.length * 0.4)).join('\n');
      const lastPart = lines.slice(-Math.floor(lines.length * 0.4)).join('\n');
      
      summary += '===\n' + firstPart + '\n...\n' + lastPart + '\n';
      
      if (summary.length > maxLength) {
        return summary.slice(0, maxLength) + '...';
      }
    }
    
    return summary;
  };

  router.post('/:proposalId/generate-checklist', validateCompany, async (req, res) => {
    try {
      const { companyName, proposalId } = req.params;
      const { projectId } = req.body;
      // Use the validated bucket from middleware
      const bucket = req.company.bucket;
      const { genAI, admin } = req.app.locals.services;
  
      console.log('Starting checklist generation:', {
        companyName,
        proposalId,
        projectId,
        bucketName: bucket.name
      });

      // Use the correct path structure
      const prefix = `projects/${projectId}/files/`;
      console.log('Looking for files with prefix:', prefix);
      
        
       let [files] = await bucket.getFiles({ prefix });
       console.log('Found files:', files.map(f => f.name));

       if (files.length === 0) {
        // Log bucket details for debugging
        console.log('Bucket debug:', {
          name: bucket.name,
          prefix,
          company: req.company
        });
        return res.status(422).json({ 
          error: 'No files found',
          details: 'Could not find any files for the specified project'
        });
      }
  
  
        // Process files with detailed logging
        const fileContents = await Promise.all(
          files.map(async (file) => {
            try {
              console.log(`Processing file: ${file.name}`);
              const [content] = await file.download();
              console.log(`Downloaded file: ${file.name}, size: ${content.length} bytes`);
              const text = await pdfParse(content);
              console.log(`Parsed file: ${file.name}, extracted text length: ${text.text.length}`);
              return {
                name: file.name.split('/').pop(),
                content: text.text.trim()
              };
            } catch (error) {
              console.error(`Error processing ${file.name}:`, error);
              return null;
            }
          })
        );
    
  
        const validContents = fileContents.filter(f => f !== null && f.content);
        console.log(`Valid contents found: ${validContents.length} files`);
        
        if (validContents.length === 0) {
          return res.status(422).json({ 
            error: 'No valid content extracted',
            details: 'Could not extract text content from any of the provided PDF files'
          });
        }
  
        // Generate checklist using Gemini
        console.log('Preparing Gemini request...');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        const combinedContent = validContents
          .map(f => `=== ${f.name} ===\n${f.content}`)
          .join('\n\n');
        
        console.log('Combined content length:', combinedContent.length);
  
        console.log('Making request to Gemini...');
        const result = await rateLimitedRequest(async () => {
          return await model.generateContent(`
  Analyze the provided RFP documents and create a comprehensive checklist of submission requirements for a proposal.
Group requirements into clear sections and ensure all critical items are included.

Format the output as follows:
- Each section should start with the section name enclosed in **Section Name**
- List items should be written as plain text sentences without any prefixes
- Do not start items with dashes, bullet points, numbers, or any special characters
- Each item should be on its own line
- Keep items clear, direct, and actionable

Example format:
**Administrative Requirements**
Submit proposal by April 15, 2024 at 5:00 PM EST
Register on the vendor portal before submission
Provide three copies of all documentation

**Technical Requirements**
Include detailed project schedule
Provide team organization chart
Submit technical specifications document

Current sections to include:

**Administrative Requirements**
Include submission deadlines, required forms, and procedural requirements
**Administrative Requirements**
Include submission deadlines, required forms, and procedural requirements

**Compliance Requirements**
Include mandatory certifications, standards, and regulatory requirements

**Technical Response Requirements**
Include required project approach documentation and technical submissions

**Team Requirements**
Include required personnel qualifications and experience documentation, sub-consultants required

**Commercial Requirements**
Include pricing, budget, and financial submission requirements

Any other categories deemed important.

RFP Content to Analyze:
${combinedContent.substring(0, 30000)} // Limit content length
  `);
        });
  
        console.log('Received response from Gemini');
        const text = result.response.text();
        console.log('Generated text length:', text.length);
  
        // Process items
        const items = text
          .split('\n')
          .filter(line => line.trim())
          .map((line, index) => {
            const isHeading = line.includes('**');
            return {
              id: `item-${index}`,
              text: line.replace(/\*\*/g, '').trim(),
              completed: false,
              isHeading,
              source: 'aggregated'
            };
          });
  
        console.log(`Created ${items.length} checklist items`);
  
        // Save to Firestore
        const now = new Date().toISOString();
        const checklist = {
          items,
          generatedAt: now,
          lastUpdated: now,
          projectId,
          metadata: {
            processedFiles: validContents.map(f => f.name),
            itemCount: items.length,
            generationStrategy: 'aggregated'
          }
        };
  
        console.log('Saving to Firestore...');
        const checklistRef = admin.firestore()
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .doc(proposalId)
        .collection('checklists')
        .doc('main');
      
        await checklistRef.set(checklist);
        res.json(checklist);
    
      } catch (error) {
        console.error('Checklist generation failed:', error);
        res.status(500).json({ 
          error: 'Failed to generate checklist',
          details: error.message || 'An unexpected error occurred'
        });
      }
    });
  
  // Add custom render function for PDF parsing
  function render_page(pageData) {
    let render_options = {
      normalizeWhitespace: true,
      disableCombineTextItems: false
    };
  
    return pageData.getTextContent(render_options)
      .then(function(textContent) {
        let lastY, text = '';
        for (let item of textContent.items) {
          if (lastY == item.transform[5] || !lastY){
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        return text;
      });
  }


  const convertMarkdownToHTML = (markdown) => {
    return markdown
      // Headers with proper spacing
      .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4 pb-2 border-b">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-10 mb-6 pb-3 border-b">$1</h1>')
      
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      
      // Lists with proper spacing and bullets
      .replace(/^- (.*$)/gm, '<li class="ml-4 text-gray-700">$1</li>')
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="my-4 space-y-2 list-disc list-inside">$1</ul>')
      
      // Paragraphs with proper spacing
      .split('\n\n')
      .map(paragraph => {
        if (paragraph.trim().startsWith('<h') || 
            paragraph.trim().startsWith('<ul')) {
          return paragraph;
        }
        return `<p class="text-gray-700 mb-4 leading-relaxed">${paragraph.trim()}</p>`;
      })
      .join('\n');
  };
  


  router.post('/:proposalId/generate-draft', validateCompany, async (req, res) => {
    try {
      const { companyName, proposalId } = req.params;
      const { projectId, regenerate = false } = req.body;
      // Use the validated bucket from middleware
      const bucket = req.company.bucket;
      const { genAI, admin } = req.app.locals.services;
  
      console.log('Starting draft generation:', {
        companyName,
        proposalId,
        projectId,
        bucketName: bucket.name
      });
  
      // Check for existing draft if not regenerating
      if (!regenerate) {
        const draftRef = admin.firestore()
          .collection('companies')
          .doc(companyName)
          .collection('proposals')
          .doc(proposalId)
          .collection('drafts')
          .doc('main');
        
        const existingDraft = await draftRef.get();
        if (existingDraft.exists) {
          console.log('Returning existing draft');
          return res.json(existingDraft.data());
        }
      }
  
      // Use the correct path structure
      const prefix = `projects/${projectId}/files/`;
      console.log('Looking for files with prefix:', prefix);
      
      let [files] = await bucket.getFiles({ prefix });
      console.log('Found files:', files.map(f => f.name));
  
      if (files.length === 0) {
        console.log('Bucket debug:', {
          name: bucket.name,
          prefix,
          company: req.company
        });
        return res.status(422).json({ 
          error: 'No files found',
          details: 'Could not find any files for the specified project'
        });
      }
  
      // Process files with detailed logging
      const fileContents = await Promise.all(
        files.map(async (file) => {
          try {
            console.log(`Processing file: ${file.name}`);
            const [content] = await file.download();
            console.log(`Downloaded file: ${file.name}, size: ${content.length} bytes`);
            const text = await pdfParse(content);
            console.log(`Parsed file: ${file.name}, extracted text length: ${text.text.length}`);
            return {
              name: file.name.split('/').pop(),
              content: text.text.trim()
            };
          } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            return null;
          }
        })
      );
  
      const validContents = fileContents.filter(f => f !== null && f.content);
      console.log(`Valid contents found: ${validContents.length} files`);
      
      if (validContents.length === 0) {
        return res.status(422).json({ 
          error: 'No valid content extracted',
          details: 'Could not extract text content from any of the provided PDF files'
        });
      }
  
      // Get proposal details
      const proposalRef = admin.firestore()
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .doc(proposalId);
      
      const proposalDoc = await proposalRef.get();
      const proposalData = proposalDoc.data();
  
      // Generate using Gemini
      console.log('Preparing Gemini request...');
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
        Create a professional proposal in markdown format for the following project:
  
        Project Name: ${proposalData.projectName}
        Organization: ${proposalData.organization}
        Category: ${proposalData.category}
  
        RFP Documents Content:
        ${validContents
          .map(f => `=== ${f.name} ===\n${f.content.substring(0, 15000)}`)
          .join('\n\n')}
  
        Create a structured proposal with the following sections using the RFP documents provided as context:
  
        # ${proposalData.projectName} - Proposal
        
        ## Executive Summary
        Start with a compelling executive summary that demonstrates understanding of the project goals and requirements.
        
        ## Project Understanding & Approach
        Explain our understanding of the project needs and our proposed approach. Be detailed.
        
        ## Methodology & Implementation
        Detail our specific methodology and implementation strategy. Be detailed.
        
        ## Quality Assurance & Risk Management
        Explain our quality control process and risk mitigation strategies.
        
        ## Timeline & Deliverables
        Provide a clear timeline and list of deliverables.
  
        Formatting Requirements:
        - Use markdown headers (#, ##, ###)
        - Present in paragraph form
        - Bold important terms with **text**
        - Keep paragraphs focused and concise
        - Use professional language
        - Include specific details from the RFP requirements
        - Ensure proper spacing between sections
        - Provide detailed and original information
      `;
  
      console.log('Making request to Gemini...');
      const result = await rateLimitedRequest(async () => {
        return await model.generateContent(prompt);
      });
  
      console.log('Received response from Gemini');
      const markdown = result.response.text();
      console.log('Generated markdown length:', markdown.length);
  
      // Convert markdown to styled HTML
      console.log('Converting markdown to HTML...');
      const htmlContent = `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              .proposal-content {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                line-height: 1.6;
                max-width: 100%;
                color: #374151;
                margin: 0;
                padding: 2rem;
              }
  
              .proposal-content h1 {
                color: #111827;
                font-size: 2rem;
                font-weight: 700;
                margin-bottom: 2rem;
                padding-bottom: 0.5rem;
                border-bottom: 2px solid #E5E7EB;
              }
  
              .proposal-content h2 {
                color: #1F2937;
                font-size: 1.5rem;
                font-weight: 600;
                margin-top: 2rem;
                margin-bottom: 1rem;
                padding-bottom: 0.25rem;
                border-bottom: 1px solid #E5E7EB;
              }
  
              .proposal-content h3 {
                color: #374151;
                font-size: 1.25rem;
                font-weight: 600;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
              }
  
              .proposal-content p {
                margin-bottom: 1.25rem;
                line-height: 1.75;
                color: #4B5563;
              }
  
              .proposal-content ul {
                margin: 1.25rem 0;
                padding-left: 1.5rem;
                list-style-type: disc;
              }
  
              .proposal-content li {
                margin-bottom: 0.5rem;
                padding-left: 0.5rem;
                color: #4B5563;
              }
  
              .proposal-content strong {
                color: #111827;
                font-weight: 600;
              }
  
              .proposal-content section {
                margin: 2rem 0;
              }
  
              @media print {
                .proposal-content {
                  padding: 0;
                }
                
                .proposal-content h1 {
                  font-size: 24pt;
                }
                
                .proposal-content h2 {
                  font-size: 18pt;
                }
                
                .proposal-content h3 {
                  font-size: 14pt;
                }
                
                .proposal-content p, 
                .proposal-content li {
                  font-size: 12pt;
                }
              }
            </style>
          </head>
          <body>
            <div class="proposal-content">
              ${convertMarkdownToHTML(markdown)}
            </div>
          </body>
        </html>`;
  
      const now = new Date().toISOString();
      const draftData = {
        content: htmlContent,
        generatedAt: now,
        lastUpdated: now,
        metadata: {
          projectName: proposalData.projectName,
          organization: proposalData.organization,
          category: proposalData.category,
          generationType: regenerate ? 'regenerated' : 'initial',
          processedFiles: validContents.map(f => f.name),
          version: regenerate ? 1 : 0
        }
      };
  
      // Save to Firestore
      console.log('Saving to Firestore...');
      const draftRef = admin.firestore()
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .doc(proposalId)
        .collection('drafts')
        .doc('main');
      
      await draftRef.set(draftData);
      console.log('Draft saved successfully');
  
      res.json(draftData);
    } catch (error) {
      console.error('Draft generation failed:', error);
      res.status(500).json({ 
        error: 'Failed to generate draft',
        details: error.message || 'An unexpected error occurred'
      });
    }
  });

module.exports = router;