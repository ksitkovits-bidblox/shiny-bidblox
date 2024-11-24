const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// Debug route
router.get('/debug/structure', async (req, res) => {
  console.log('Debug structure route hit');
  try {
    const proposalsRef = db.collection('proposals');
    const snapshot = await proposalsRef.get();
    
    const debugInfo = {
      totalProposals: snapshot.size,
      proposals: []
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      debugInfo.proposals.push({
        id: doc.id,
        hasProjectId: !!data.projectId,
        hasProjectName: !!data.projectName,
        hasOrganization: !!data.organization,
        hasCategory: !!data.category,
        hasDueDate: !!data.dueDate,
        hasStatus: !!data.status,
        rawData: data
      });
    });

    res.json(debugInfo);
  } catch (error) {
    console.error('Debug route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all proposals
router.get('/', async (req, res) => {
  try {
    console.log('Fetching all proposals...');
    const proposalsRef = db.collection('proposals');
    const snapshot = await proposalsRef.get();
    
    const proposals = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      proposals.push({ 
        id: doc.id, 
        ...data,
        dueDate: data.dueDate ? data.dueDate : null
      });
    });
    
    console.log(`Successfully retrieved ${proposals.length} proposals`);
    res.json(proposals);
  } catch (error) {
    console.error('Error fetching all proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// Get single proposal
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching proposal with ID:', id);

    const proposalRef = db.collection('proposals').doc(id);
    const doc = await proposalRef.get();

    console.log('Document exists:', doc.exists);

    if (!doc.exists) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const data = doc.data();
    const response = {
      id: doc.id,
      ...data,
      dueDate: data.dueDate ? data.dueDate : null
    };

    console.log('Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// Create new proposal
router.post('/', async (req, res) => {
  try {
    const {
      projectId,
      projectName,
      organization,
      category,
      dueDate,
      status = 'draft',
      companyName  // Need this from request
    } = req.body;

    // Validate required fields including companyName
    if (!projectId || !projectName || !organization || !category || !companyName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['projectId', 'projectName', 'organization', 'category', 'companyName']
      });
    }

    const newProposal = {
      projectId,
      projectName,
      organization,
      category,
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      status,
      createdAt: new Date(),
      companyName  // Add this here
    };

    // Use the nested structure
    const proposalRef = await db
      .collection('companies')
      .doc(companyName)
      .collection('proposals')
      .add(newProposal);

    res.json({
      id: proposalRef.id,
      ...newProposal
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// Update proposal
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    console.log('Updating proposal:', id, updateData);

    const proposalRef = db.collection('proposals').doc(id);
    await proposalRef.update(updateData);
    
    const updatedDoc = await proposalRef.get();
    const data = updatedDoc.data();

    res.json({ 
      id: updatedDoc.id, 
      ...data
    });
  } catch (error) {
    console.error('Error updating proposal:', error);
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// Add delete route
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting proposal with ID:', id);

    // Check if proposal exists
    const proposalRef = db.collection('proposals').doc(id);
    const doc = await proposalRef.get();

    if (!doc.exists) {
      console.log('Proposal not found:', id);
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Delete the proposal
    await proposalRef.delete();
    console.log('Successfully deleted proposal:', id);

    res.json({ 
      message: 'Proposal deleted successfully',
      id 
    });
  } catch (error) {
    console.error('Error deleting proposal:', error);
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

module.exports = router;