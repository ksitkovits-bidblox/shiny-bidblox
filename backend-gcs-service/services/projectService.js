// services/projectService.js
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');


const normalizeCompanyName = (company) => {
  if (!company) return '';
  const companyName = typeof company === 'string' ? company : company.toString();
  return companyName.toLowerCase();
};


class ProjectService {
  constructor() {
    if (!admin.apps.length) {
      throw new Error('Firebase must be initialized before creating ProjectService');
    }
    
    try {
      this.db = getFirestore();
      console.log('ProjectService initialized with Firestore:', {
        isInitialized: !!this.db,
        hasAdmin: !!admin.apps.length
      });
    } catch (error) {
      console.error('Failed to initialize ProjectService:', error);
      throw error;
    }
  }


  // Add a static method to create an instance after ensuring Firebase is initialized
  static getInstance() {
    if (!admin.apps.length) {
      throw new Error('Firebase must be initialized before creating ProjectService');
    }
    return new ProjectService();
  }

  normalizeProjectData(data) {
    // Normalize analyses to ensure correct structure
    const normalizedAnalyses = {};
    if (data.analyses) {
      Object.entries(data.analyses).forEach(([key, analysis]) => {
        if (analysis && analysis.content) {
          normalizedAnalyses[key] = {
            content: analysis.content,
            generatedAt: analysis.generatedAt || new Date().toISOString(),
            fileCount: analysis.fileCount || 0
          };
        }
      });
    }

    return {
      ...data,
      rfpNumber: data.rfpNumber || '', // Ensure RFP number is normalized
      files: data.files || [],
      analyses: normalizedAnalyses,
      executiveSummary: data.executiveSummary ? {
        ...data.executiveSummary,
        fileCount: data.executiveSummary.fileCount || 0,
        lastUpdated: data.executiveSummary.lastUpdated || data.executiveSummary.generatedAt || null
      } : null,
      updatedAt: data.updatedAt || new Date().toISOString()
    };
  }

/*
  async getProject(projectId, company) {
    try {
      const normalizedCompany = normalizeCompanyName(company);
      console.log('Fetching project:', { projectId, company: normalizedCompany });
      const docRef = this.db
  .collection('companies')
  .doc(normalizedCompany)
  .collection('projects')
  .doc(projectId);

      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.log('Project not found:', { projectId, normalizedCompany });
        return null;
      }
      
      const data = doc.data();
      console.log('Retrieved project:', {
        id: projectId,
        normalizedCompany,
        exists: true,
        hasExecutiveSummary: !!data.executiveSummary
      });
      
      const normalizedData = this.normalizeProjectData(data);
      return { id: doc.id, ...normalizedData };
    } catch (error) {
      console.error('Error getting project:', { projectId, company, error: error.message });
      return null;
    }
  }*/
    async getProject(projectId, company) {
      try {
        const normalizedCompany = normalizeCompanyName(company);
        console.log('Getting project from Firestore:', {
          projectId,
          company: normalizedCompany,
          path: `companies/${normalizedCompany}/projects/${projectId}`
        });
    
        // Test write to root level first
        await this.db.collection('test').doc('test').set({
          test: true,
          timestamp: new Date()
        });
        console.log('Root level write successful');
    
        // Then try company level
        await this.db.collection('companies').doc(normalizedCompany).set({
          test: true,
          timestamp: new Date()
        }, { merge: true });
        console.log('Company level write successful');
    
        // Then try to read the actual project
        const docRef = this.db
          .collection('companies')
          .doc(normalizedCompany)
          .collection('projects')
          .doc(projectId);
    
        const doc = await docRef.get();
        
        // Log the result
        console.log('Project document access result:', {
          exists: doc.exists,
          path: doc.ref.path,
          id: doc.id
        });
    
        if (!doc.exists) {
          console.log('Project not found:', { projectId, normalizedCompany });
          return null;
        }
        
        const data = doc.data();
        console.log('Retrieved project data:', {
          id: projectId,
          normalizedCompany,
          exists: true,
          hasExecutiveSummary: !!data.executiveSummary,
          dataKeys: Object.keys(data)
        });
        
        const normalizedData = this.normalizeProjectData(data);
        return { id: doc.id, ...normalizedData };
      } catch (error) {
        console.error('Error getting project:', {
          projectId,
          company,
          error: error.message,
          errorCode: error.code,
          path: `companies/${normalizedCompany}/projects/${projectId}`,
          stack: error.stack
        });
        throw error;
      }
    }

    
      async getAnalysis(params) {
        const { projectId, prompt, questionId, normalizedCompany, forceRegenerate = false } = params;
    
        try {
          console.log('Starting analysis:', {
            projectId,
            normalizedCompany,
            questionId
          });
    
          // Get project metadata first
          const projectRef = this.db
            .collection('companies')
            .doc(normalizedCompany)
            .collection('projects')
            .doc(projectId);
    
          const projectSnap = await projectRef.get();
          if (!projectSnap.exists) {
            throw new Error('Project not found');
          }
    
          const project = projectSnap.data();
    
          // Check for cached analysis
          if (!forceRegenerate) {
            const analysisRef = projectRef.collection('analyses').doc(questionId);
            const existing = await analysisRef.get();
            if (existing.exists) {
              const data = existing.data();
              return {
                analysis: data.content,
                generatedAt: data.generatedAt,
                wasRegenerated: false,
                fileCount: data.fileCount,
                normalizedCompany
              };
            }
          }
    
          // Get file metadata from Firestore
          const projectFiles = project.files || [];
          
          console.log('Retrieved project metadata:', {
            projectId,
            normalizedCompany,
            hasFiles: projectFiles.length > 0,
            fileCount: projectFiles.length
          });
    
          return {
            projectId,
            normalizedCompany,
            files: projectFiles,
            project
          };
    
        } catch (error) {
          console.error('Analysis error:', {
            error,
            projectId,
            normalizedCompany,
            questionId
          });
          throw error;
        }
      }
    
    
      // Add helper method for saving analysis
      async saveAnalysis(projectId, questionId, analysisData, normalizedCompany) {
        try {
          const batch = this.db.batch();
    
          // Reference to analysis document
          const analysisRef = this.db
            .collection('companies')
            .doc(normalizedCompany)
            .collection('projects')
            .doc(projectId)
            .collection('analyses')
            .doc(questionId);
    
          // Reference to project document
          const projectRef = this.db
            .collection('companies')
            .doc(normalizedCompany)
            .collection('projects')
            .doc(projectId);
    
          // Set analysis in subcollection
          batch.set(analysisRef, {
            content: analysisData.content,
            generatedAt: analysisData.generatedAt,
            fileCount: analysisData.fileCount,
            normalizedCompany
          });
    
          // Update project document
          batch.update(projectRef, {
            [`analyses.${questionId}`]: {
              content: analysisData.content,
              generatedAt: analysisData.generatedAt,
              fileCount: analysisData.fileCount,
              normalizedCompany
            },
            updatedAt: new Date().toISOString()
          });
    
          await batch.commit();
    
          console.log('Analysis saved successfully:', {
            projectId,
            questionId,
            normalizedCompany,
            timestamp: analysisData.generatedAt
          });
    
        } catch (error) {
          console.error('Error saving analysis:', {
            error,
            projectId,
            questionId,
            normalizedCompany
          });
          throw error;
        }
      }
    

  // Helper method to validate and normalize project data
  normalizeProjectData(data) {
    return {
      ...data,
      rfpNumber: data.rfpNumber || '', // Ensure RFP number is normalized
      files: data.files || [],
      analyses: data.analyses || {},
      executiveSummary: data.executiveSummary ? {
        ...data.executiveSummary,
        fileCount: data.executiveSummary.fileCount || 0,
        lastUpdated: data.executiveSummary.lastUpdated || data.executiveSummary.generatedAt || null
      } : null,
      updatedAt: data.updatedAt || new Date().toISOString()
    };
  }


  async getAllProjects(company) {
    try {
      const normalizedCompany = normalizeCompanyName(company);
      console.log('Starting getAllProjects:', { normalizedCompany });
  
      // Step 1: Try to access/create company document first
      const companyRef = this.db.collection('companies').doc(normalizedCompany);
      
      try {
        await companyRef.set({
          name: normalizedCompany,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        
        console.log('Company document created/updated successfully');
      } catch (error) {
        console.error('Error with company document:', error);
        throw error;
      }
  
      // Step 2: Try to create projects collection if it doesn't exist
      const projectsRef = companyRef.collection('projects');
      
      try {
        // Try creating a temporary document to ensure collection exists
        const tempDoc = await projectsRef.doc('temp').set({
          _temp: true,
          createdAt: new Date().toISOString()
        });
        
        // Immediately delete it
        await projectsRef.doc('temp').delete();
        
        console.log('Projects collection verified');
      } catch (error) {
        console.error('Error verifying projects collection:', error);
        throw error;
      }
  
      // Step 3: Now try to get all projects
      try {
        const snapshot = await projectsRef.get();
        console.log('Projects fetch successful:', {
          empty: snapshot.empty,
          size: snapshot.size
        });
  
        const projects = snapshot.docs
          .filter(doc => !doc.data()._temp) // Filter out any temp docs
          .map(doc => ({
            id: doc.id,
            ...this.normalizeProjectData(doc.data())
          }));
  
        return projects;
      } catch (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }
  
    } catch (error) {
      console.error('Error in getAllProjects:', {
        company,
        normalizedCompany: normalizeCompanyName(company),
        error: error.message,
        code: error.code
      });
      return []; // Return empty array on error
    }
  }

  
async updateAnalysis(projectId, questionId, analysisData, company) {
  try {
    const normalizedCompany = normalizeCompanyName(company);
    if (!questionId || !analysisData.content) {
      throw new Error('Invalid analysis data: questionId and content are required');
    }

    console.log('Updating analysis:', {
      projectId,
      company,
      questionId,
      contentLength: analysisData.content.length,
      fileCount: analysisData.fileCount
    });

    const docRef = this.db
      .collection('companies')
      .doc(normalizedCompany)
      .collection('projects')
      .doc(projectId);
    
    // First get current analyses to verify update
    const currentProject = await this.getProject(projectId, normalizedCompany);
    const currentAnalyses = currentProject?.analyses || {};
    
    const updateData = {
      analyses: {
        ...currentAnalyses,
        [questionId]: {
          content: analysisData.content,
          generatedAt: analysisData.generatedAt || new Date().toISOString(),
          fileCount: analysisData.fileCount
        }
      },
      updatedAt: new Date().toISOString()
    };

    await docRef.set(updateData, { merge: true });
    
    console.log('Analysis update complete:', {
      questionId,
      normalizedCompany,
      analysesCount: Object.keys(updateData.analyses).length
    });

    return updateData.analyses[questionId];
  } catch (error) {
    console.error('Error updating analysis:', {
      error: error.message,
      projectId,
      comapny,
      questionId
    });
    throw error;
  }
}

  

async updateExecutiveSummary(projectId, summary, company) {
  try {
    const normalizedCompany = normalizeCompanyName(company);
    if (!summary.content) {
      throw new Error('Invalid summary data: content is required');
    }

    console.log('Updating executive summary:', {
      projectId,
      company,
      fileCount: summary.fileCount,
      hasContent: !!summary.content
    });

    const docRef = this.db
      .collection('companies')
      .doc(normalizedCompany)
      .collection('projects')
      .doc(projectId);
    
    const updateData = {
      executiveSummary: {
        content: summary.content,
        generatedAt: summary.generatedAt || new Date().toISOString(),
        fileCount: summary.fileCount,
        lastUpdated: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };

    await docRef.set(updateData, { merge: true });
    
    // Verify update
    const updatedProject = await this.getProject(projectId, normalizedCompany);
    console.log('Executive summary update verified:', {
      success: !!updatedProject.executiveSummary?.content,
      fileCount: updatedProject.executiveSummary?.fileCount,
      timestamp: updatedProject.executiveSummary?.generatedAt,
      lastUpdated: updatedProject.executiveSummary?.lastUpdated,
      company
    });

    return updatedProject.executiveSummary;
  } catch (error) {
    console.error('Error updating executive summary:', {
      error: error.message,
      projectId,
      normalizedCompany
    });
    throw error;
  }
}


  async hasValidAnalysis(projectId, questionId) {
    try {
      const analysis = await this.getAnalysis(projectId, questionId);
      const isValid = !!(analysis?.content && analysis?.generatedAt && analysis?.fileCount);
      
      console.log('Analysis validity check:', {
        questionId,
        exists: !!analysis,
        isValid,
        fileCount: analysis?.fileCount
      });

      return isValid;
    } catch (error) {
      console.error('Error checking analysis validity:', error);
      return false;
    }
  }


  async createProject(projectData, company) {
    try {
      const normalizedCompany = normalizeCompanyName(company);
      if (!projectData.id || !projectData.name) {
        throw new Error('Invalid project data: id and name are required');
      }
  
      console.log('Creating project with auth:', {
        id: projectData.id,
        name: projectData.name,
        rfpNumber: projectData.rfpNumber,
        organization: projectData.organization,
        normalizedCompany,
        hasAuth: !!this.auth,  // Add this debug line
        path: `companies/${company.toLowerCase()}/projects/${projectData.id}`
      });
  
      const docRef = this.db
      .collection('companies')
      .doc(normalizedCompany)
      .collection('projects')
      .doc(projectData.id);
        
      const projectWithDefaults = {
        id: projectData.id,
        rfpNumber: projectData.rfpNumber || '',
        name: projectData.name,
        organization: projectData.organization,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bidStatus: 'pending',
        files: [],
        analyses: {},
        executiveSummary: null
      };
      
      await docRef.set(projectWithDefaults);
      
      return projectWithDefaults;
    } catch (error) {
      console.error('Error creating project:', {
        error: error.message,
        projectId: projectData.id,
        normalizedCompany,
        hasAuth: !!this.auth  // Add this debug line
      });
      throw error;
    }
  }

  
  async updateProject(projectId, updateData, company) {
    try {
      const normalizedCompany = normalizeCompanyName(company);
      console.log('Updating project:', {
        projectId,
        fields: Object.keys(updateData)
      });

      const docRef = this.db.collection('companies')
      .doc(normalizedCompany)
      .collection('projects').doc(projectId);
      
      const mergeData = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      
      await docRef.set(mergeData, { merge: true });
      
      // Verify update
      const updatedProject = await this.getProject(projectId, normalizedCompany);
      console.log('Project update verified:', {
        success: !!updatedProject,
        timestamp: updatedProject?.updatedAt
      });

      return updatedProject;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  async deleteProject(projectId, company) {
    try {
      const normalizedCompany = normalizeCompanyName(company);
      console.log('Deleting project:', projectId);
      
      // Verify project exists before deletion
      const exists = await this.getProject(projectId, normalizedCompany);
      if (!exists) {
        throw new Error('Project not found');
      }

      const docRef = this.db.collection('companies').doc(normalizedCompany).collection('projects').doc(projectId);
      await docRef.delete();
      
      console.log('Project deleted successfully:', projectId);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }
}

// Export a single instance
module.exports = {
  ProjectService,  // Export the class instead of an instance
  normalizeCompanyName
};