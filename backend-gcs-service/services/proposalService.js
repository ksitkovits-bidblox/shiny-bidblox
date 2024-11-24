// services/proposalService.js
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

class ProposalService {
  constructor() {
    if (!admin.apps.length) {
      throw new Error('Firebase must be initialized before creating ProposalService');
    }
    
    try {
      this.db = getFirestore();
      console.log('ProposalService initialized with Firestore:', {
        isInitialized: !!this.db,
        hasAdmin: !!admin.apps.length
      });
    } catch (error) {
      console.error('Failed to initialize ProposalService:', error);
      throw error;
    }
  }


  async createProposal(data) {
    try {
      console.log('Service received proposal data:', data);
      
      // Validate required fields
      const requiredFields = ['projectId', 'projectName', 'organization', 'companyName'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
  
      // Check if proposal already exists for this project
      const existingProposals = await this.db
        .collection('companies')
        .doc(data.companyName)
        .collection('proposals')
        .where('projectId', '==', data.projectId)
        .get();
  
      if (!existingProposals.empty) {
        console.log('Proposal already exists for project:', {
          projectId: data.projectId,
          companyName: data.companyName,
          existingProposalId: existingProposals.docs[0].id
        });
        
        // Return the existing proposal instead of creating a new one
        return {
          id: existingProposals.docs[0].id,
          ...existingProposals.docs[0].data(),
          alreadyExists: true
        };
      }
  
      const normalizedData = {
        projectId: data.projectId,
        projectName: data.projectName,
        organization: data.organization,
        companyName: data.companyName,
        category: data.category || 'construction',
        status: data.status || 'draft',
        dueDate: data.dueDate || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        files: [],
        metadata: {
          version: 1,
          lastModified: new Date().toISOString()
        }
      };
  
      // Create proposal in company's subcollection
      const proposalRef = this.db
        .collection('companies')
        .doc(data.companyName)
        .collection('proposals')
        .doc();
  
      await proposalRef.set(normalizedData);
      
      return { 
        id: proposalRef.id, 
        ...normalizedData,
        alreadyExists: false
      };
    } catch (error) {
      console.error('Error in createProposal:', error);
      throw error;
    }
  }

  async getProposal(companyName, proposalId) {
    try {
      console.log('ProposalService.getProposal:', {
        companyName,
        proposalId,
        path: `companies/${companyName}/proposals/${proposalId}`
      });

      if (!companyName || !proposalId) {
        throw new Error('Company name and proposal ID are required');
      }

      const proposalRef = this.db
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .doc(proposalId);

      const doc = await proposalRef.get();
      
      if (!doc.exists) {
        console.log('Proposal not found:', {
          companyName,
          proposalId
        });
        return null;
      }

      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error getting proposal:', {
        companyName,
        proposalId,
        error: error.message
      });
      throw error;
    }
  }


  // Update existing getDraft method
async getDraft(proposalId, companyName) {
  try {
    console.log('Getting draft:', { proposalId, companyName });
    
    if (!proposalId || !companyName) {
      throw new Error('Both proposalId and companyName are required');
    }

    const draftRef = this.db
      .collection('companies')
      .doc(companyName.toLowerCase())
      .collection('proposals')
      .doc(proposalId)
      .collection('drafts')
      .doc('main'); // Changed from 'latest' to 'main' to match your structure

    console.log('Fetching draft from path:', draftRef.path);
    
    const snapshot = await draftRef.get();
    if (!snapshot.exists) {
      console.log('No draft found');
      return null;
    }
    
    return snapshot.data();
  } catch (error) {
    console.error('Error in getDraft:', error);
    throw error;
  }
}

// Add saveDraft method
async saveDraft(companyName, proposalId, draftData) {
  try {
    console.log('Saving draft:', { 
      proposalId, 
      companyName,
      path: `companies/${companyName}/proposals/${proposalId}/drafts/main`
    });

    if (!proposalId || !companyName) {
      throw new Error('Both proposalId and companyName are required');
    }

    const draftRef = this.db
      .collection('companies')
      .doc(companyName.toLowerCase())
      .collection('proposals')
      .doc(proposalId)
      .collection('drafts')
      .doc('main');

    await draftRef.set(draftData);
    return draftData;
  } catch (error) {
    console.error('Error saving draft:', error);
    throw error;
  }
}


  async getAllProposals(companyName) {
    try {
      if (!companyName) throw new Error('Company name is required');

      const snapshot = await this.db
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting all proposals:', error);
      throw error;
    }
  }

  async updateProposal(companyName, proposalId, updateData) {
    try {
      if (!companyName) throw new Error('Company name is required');
      
      const docRef = this.db
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .doc(proposalId);

      const mergeData = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      
      await docRef.set(mergeData, { merge: true });
      return this.getProposal(companyName, proposalId);
    } catch (error) {
      console.error('Error updating proposal:', error);
      throw error;
    }
  }

  

  async getChecklist(companyName, proposalId) {
    try {
      console.log('Getting checklist:', { proposalId, companyName });
      
      if (!companyName || !proposalId) {
        throw new Error('Company name and proposal ID are required');
      }

      const checklistRef = this.db
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .doc(proposalId)
        .collection('checklists')
        .doc('main');

      const doc = await checklistRef.get();
      
      if (!doc.exists) {
        console.log('No checklist found for:', { proposalId, companyName });
        return null;
      }

      return doc.data();
    } catch (error) {
      console.error('Error in getChecklist:', error);
      throw error;
    }
  }


  async deleteProposal(companyName, proposalId) {
    try {
      console.log('Deleting proposal:', {
        companyName,
        proposalId,
        path: `companies/${companyName}/proposals/${proposalId}`
      });
  
      if (!companyName || !proposalId) {
        throw new Error('Company name and proposal ID are required');
      }
  
      const proposalRef = this.db
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .doc(proposalId);
  
      console.log('Deleting document at path:', proposalRef.path);
      
      await proposalRef.delete();
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting proposal:', {
        error: error.message,
        companyName,
        proposalId
      });
      throw error;
    }
  }

  async getProposalsByProject(companyName, projectId) {
    try {
      console.log('Fetching proposals for project:', { companyName, projectId });
      
      const snapshot = await this.db
        .collection('companies')
        .doc(companyName)
        .collection('proposals')
        .where('projectId', '==', projectId)
        .get();

      const proposals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() // Removed normalizeProposalData since it's not needed
      }));

      console.log(`Found ${proposals.length} proposals for project ${projectId}`);
      return proposals;
    } catch (error) {
      console.error('Error getting proposals by project:', error);
      throw error;
    }
  }
}

// Export as a class
module.exports = ProposalService;