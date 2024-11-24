  // src/utils/api.ts
  import { User } from 'firebase/auth';
  import { UserProfile } from '@/types/organization';
  


  interface RequestConfig {
    user: User | null;
    userProfile: UserProfile | null;
    isAuthenticated: boolean;
  }

  interface FileUploadResponse {
    fileUrl: string;
    fileName: string;
    contentType: string;
    size: number;
  }
  interface FileMetadata {
    contentType: string;
    size: number;
    lastModified: number;
    projectId: string;
    companyName: string;
  }

  export interface FileResponse {
    fileName: string;
    fileUrl: string;
    size: number;
    contentType: string;
    uploadedAt: string;
  }

  interface ApiResponse {
    files?: FileResponse[];
  }

  export interface ExportOptions {
    format: 'pdf' | 'docx';
    data: {
      projectName: string;
      organization: string;
      category: string;
      dueDate: string;
      content: string;
      generatedAt: string;
    };
  }



  interface AnalysisResponse {
    analysis: string;
    generatedAt: string;
    wasRegenerated: boolean;
    fileCount: number;
  }

  interface ExecutiveSummaryResponse {
    analysis: string;
    generatedAt: string;
    wasRegenerated: boolean;
    fileCount: number;
  }


  interface ProjectMetadataUpdate {
    executiveSummary: {
      content: string;
      generatedAt: string;
      fileCount: number;
    };
  }

  interface ProposalDraft {
    content: string;
    generatedAt: string;
    lastUpdated: string;
    metadata: {
      projectName: string;
      organization: string;
      category: string;
      generationType: 'initial' | 'regenerated';
      version: number;
    };
  }
  
  export interface ChecklistItem {
    id: string;
    text: string;
    completed: boolean;
    isHeading: boolean;
  }
  
  
  
 export interface ProposalChecklist {
    items: ChecklistItem[];
    generatedAt: string;
    lastUpdated: string;
    projectId: string;
    metadata: {
      processedFiles: string[];
      itemCount: number;
      generationStrategy: string;
    };
  }

  
  

  export const getCompanyFromEmail = (email: string): string => {
    const domain = email.split('@')[1];
    // Return lowercase directly
    return domain.split('.')[0].toLowerCase();
  };

  export const getStoragePath = (companyName: string, projectId: string, fileName: string = '') => {
    return `company-${companyName.toLowerCase()}/projects/${projectId}/files/${fileName}`.replace(/\/+$/, '');
  };


  const constructApiUrl = (endpoint: string, params: Record<string, string> = {}) => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || '';
    const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.slice(4) : endpoint;
    let url = `${baseUrl}/api${cleanEndpoint}`;
    
    const queryParams = new URLSearchParams(params).toString();
    if (queryParams) {
      url += `?${queryParams}`;
    }
    
    return url;
  };




  export const makeRequest = async (
    endpoint: string,
    config: RequestConfig,
    options: RequestInit = {}
  ) => {
    if (!config.isAuthenticated || !config.user?.email) {
      console.error('Auth validation failed:', {
        isAuthenticated: config.isAuthenticated,
        hasUser: !!config.user,
        email: config.user?.email
      });
      throw new Error('Authentication required');
    }

    try {
      const token = await config.user.getIdToken(true);
      const url = constructApiUrl(endpoint);
      
      // Get company name from email domain
      const companyName = getCompanyFromEmail(config.user.email).toLowerCase();

      console.log('API Request:', {
        url,
        method: options.method || 'GET',
        company: companyName,
        userId: config.user.uid,
        email: config.user.email
      });

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'x-company-name': companyName
      };
      

      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        }
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorData;
        
        try {
          errorData = contentType?.includes('application/json') 
            ? await response.json()
            : await response.text();
        } catch (e) {
          errorData = 'Could not parse error response';
        }

        throw new Error(
          errorData?.error || errorData?.message || 
          `Request failed: ${response.status} ${response.statusText}`
        );
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      if (contentType?.includes('application/octet-stream')) {
        return await response.blob();
      }
      return await response.text();

    } catch (error) {
      console.error('Request failed:', {
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  };

  export const companyApi = (config: RequestConfig) => {
    if (!config.isAuthenticated || !config.user?.email) {
      console.warn('Invalid API configuration:', {
        isAuthenticated: config.isAuthenticated,
        hasUser: !!config.user,
        email: config.user?.email
      });
      return null;
    }

    const user = config.user;
    const email = user.email as string;
    const companyName = getCompanyFromEmail(email).toLowerCase();
    const bucketPrefix = import.meta.env.VITE_BUCKET_PREFIX || '';



    const getProjectStoragePath = (projectId: string, fileName: string = '') => {
      return getStoragePath(companyName, projectId, fileName);
    };


    return {
      projects: {
        getAll: async () => {
          console.log('Fetching all projects for:', companyName);
          return makeRequest(`/companies/${companyName}/projects`, config);
        },

        get: (projectId: string) => 
          makeRequest(`/companies/${companyName}/projects/${projectId}`, config),
        
        create: (projectData: any) => 
          makeRequest(`/companies/${companyName}/projects`, config, {
            method: 'POST',
            body: JSON.stringify(projectData),
          }),
        
        delete: (projectId: string) => 
          makeRequest(`/companies/${companyName}/projects/${projectId}`, config, {
            method: 'DELETE',
          }),
        
          updateStatus: async (projectId: string, status: 'go' | 'no-go' | 'pending') => {
            console.log('Updating project status:', {
              projectId,
              status,
              companyName
            });
    
            return makeRequest(
              `/companies/${companyName}/projects/${projectId}/status`,
              config,
              {
                method: 'PATCH',
                body: JSON.stringify({ status })
              }
            );
          },

        generateExecutiveSummary: async (projectId: string, forceRegenerate: boolean = false): Promise<ExecutiveSummaryResponse> => {
          console.log('Requesting executive summary generation:', {
            projectId,
            company: companyName,
            forceRegenerate
          });
      
          return makeRequest(
            `/companies/${companyName}/projects/${projectId}/ai/executive-summary`,
            config,
            {
              method: 'POST',
              body: JSON.stringify({
                forceRegenerate
              })
            }
          );
        },
        
        updateMetadata: async (projectId: string, metadata: ProjectMetadataUpdate) => {
          console.log('Updating project metadata:', {
            projectId,
            company: companyName,
            updateType: metadata.executiveSummary ? 'executiveSummary' : 'general'
          });
      
          return makeRequest(
            `/companies/${companyName}/projects/${projectId}/metadata`,
            config,
            {
              method: 'POST',
              body: JSON.stringify(metadata)
            }
          );
        },
        
        getMetadata: (projectId: string) =>
          makeRequest(`/companies/${companyName}/projects/${projectId}/metadata`, config),
        
        analyze: (projectId: string, data: { prompt: string; questionId: string; forceRegenerate?: boolean }) => {
          console.log('Making analyze request:', {
            projectId,
            company: companyName,
            questionId: data.questionId,
            endpoint: `/companies/${companyName}/projects/${projectId}/analyze`
          });
  
          return makeRequest(
            `/companies/${companyName}/projects/${projectId}/analyze`,
            config,
            {
              method: 'POST',
              body: JSON.stringify({
                ...data,
                companyName // Include company name in the request body
              })
            }
          );
        },
        
        getAnalyses: (projectId: string) =>
          makeRequest(
            `/companies/${companyName}/projects/${projectId}/analyses`,
            config
          ),
        
        updateAnalysis: (projectId: string, questionId: string, analysisData: any) =>
          makeRequest(
            `/companies/${companyName}/projects/${projectId}/analyses/${questionId}`,
            config,
            {
              method: 'PATCH',
              body: JSON.stringify(analysisData)
            }
          )
      },
      

proposals: {
  getAll: async () => {
    console.log('Fetching all proposals for:', companyName);
    return makeRequest(`/companies/${companyName}/proposals`, config);
  },

  get: async (proposalId: string) => {
    console.log('Fetching proposal:', { proposalId, companyName });
    return makeRequest(
      `/companies/${companyName}/proposals/${proposalId}`,
      config
    );
  },


export: async (proposalId: string, format: ExportOptions['format'], data: ExportOptions['data']): Promise<Blob> => {
  console.log('Exporting proposal:', { proposalId, format, companyName });
  return makeRequest(
    `/companies/${companyName}/proposals/${proposalId}/export`,
    config,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/octet-stream',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ format, data })
    }
  );
},
  
  create: async (proposalData: any) => {
    console.log('Creating proposal:', { proposalData, companyName });
    return makeRequest(
      `/companies/${companyName}/proposals`,
      config,
      {
        method: 'POST',
        body: JSON.stringify({
          ...proposalData,
          companyName
        })
      }
    );
  },

  update: async (proposalId: string, updateData: any) => {
    console.log('Updating proposal:', { proposalId, updateData, companyName });
    return makeRequest(
      `/companies/${companyName}/proposals/${proposalId}`,
      config,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...updateData,
          companyName
        })
      }
    );
  },

  delete: async (proposalId: string) => {
    console.log('Deleting proposal:', { proposalId, companyName });
    return makeRequest(
      `/companies/${companyName}/proposals/${proposalId}`,
      config,
      { method: 'DELETE' }
    );
  },

  getDraft: async (proposalId: string): Promise<ProposalDraft> => {
    console.log('Fetching proposal draft:', { proposalId, companyName });
    return makeRequest(
      `/companies/${companyName}/proposals/${proposalId}/draft`,
      config
    );
  },

  generateDraft: async (
    proposalId: string,
    projectId: string,
    regenerate: boolean = false
  ): Promise<ProposalDraft> => {
    console.log('Generating draft:', { proposalId, projectId, regenerate });
    return makeRequest(
      `/companies/${companyName}/proposals/${proposalId}/generate-draft`,
      config,
      {
        method: 'POST',
        body: JSON.stringify({ projectId, regenerate })
      }
    );
  },

  getChecklist: async (proposalId: string): Promise<ProposalChecklist> => {
    console.log('Fetching checklist:', { proposalId, companyName });
    return makeRequest(
      `/companies/${companyName}/proposals/${proposalId}/checklist`,
      config
    );
  },

  generateChecklist: async (
    proposalId: string,
    projectId: string
  ): Promise<ProposalChecklist> => {
    console.log('Generating checklist:', { proposalId, projectId, companyName });
    return makeRequest(
      `/companies/${companyName}/proposals/${proposalId}/generate-checklist`,
      config,
      {
        method: 'POST',
        body: JSON.stringify({ projectId })
      }
    );
  },

  updateChecklistItem: async (
    proposalId: string,
    itemId: string,
    completed: boolean
  ): Promise<ProposalChecklist> => {
    console.log('Updating checklist item:', { proposalId, itemId, completed });
    return makeRequest(
      `/companies/${companyName}/proposals/${proposalId}/checklist/items/${itemId}`,
      config,
      {
        method: 'PATCH',
        body: JSON.stringify({ completed })
      }
    );
  }
},

      
      files: {
        upload: async (projectId: string, files: FileList | File[]): Promise<FileUploadResponse[]> => {
          // 1. Log initial state
          console.log('Starting upload with:', {
            isAuthenticated: config.isAuthenticated,
            userEmail: email,
            projectId,
            fileCount: files.length,
            bucketPrefix
          });

          // 2. Get and verify token
          let token;
          try {
            token = await user.getIdToken(true);
            console.log('Token obtained:', token ? `${token.substring(0, 20)}...` : 'null');
          } catch (error) {
            console.error('Token error:', error);
            throw new Error('Failed to get authentication token');
          }

          // 3. Build request
          const formData = new FormData();
          const url = constructApiUrl(`/companies/${companyName}/projects/${projectId}/files`);
          const headers = {
            'Authorization': `Bearer ${token}`,
            'x-company-name': companyName
          };

          // Add files to formData with storage paths
          Array.from(files).forEach((file, index) => {
            const storagePath = getProjectStoragePath(projectId, file.name);
            console.log(`Processing file ${index + 1}:`, {
              name: file.name,
              type: file.type,
              size: file.size,
              storagePath
            });
            
            formData.append(`files`, file);
            formData.append(`metadata${index}`, JSON.stringify({
              fileName: file.name,
              contentType: file.type,
              size: file.size,
              projectId,
              companyName: companyName,
              storagePath
            }));
          });

          // 4. Log full request details
          console.log('Making request:', {
            url,
            method: 'POST',
            headers,
            basePath: getStoragePath(companyName, projectId),          
            fileCount: files.length,
            formDataEntries: Array.from(formData.entries()).map(([key]) => key)
          });

          // 5. Make request with error handling
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers,
              body: formData
            });

            console.log('Response received:', {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers)
            });

            if (!response.ok) {
              const text = await response.text();
              console.log('Error response:', text);
              throw new Error(text);
            }

            const result = await response.json();
            console.log('Success response:', result);
            return result;
          } catch (error) {
            console.error('Request failed:', error);
            throw error;
          }
        },
        
        getContent: async (projectId: string, fileName: string): Promise<Response> => {
          const token = await user.getIdToken(true);
          if (!token) throw new Error('Authentication required');
      
          const url = constructApiUrl(`/companies/${companyName}/projects/${projectId}/files/${fileName}/download`);
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-company-name': companyName
            }
          });
      
          if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }
      
          return response;
        },
      
        download: async (projectId: string, fileName: string): Promise<Blob> => {
          console.log('Downloading file:', {
            projectId,
            fileName,
            companyName
          });
      
          return makeRequest(
            `/companies/${companyName}/projects/${projectId}/files/${fileName}/download`,
            config,
            {
              headers: {
                'Accept': 'application/octet-stream'
              }
            }
          );
        },
      
      
        delete: async (projectId: string, fileName: string) => {
          console.log('Deleting file:', {
            projectId,
            fileName,
            companyName
          });
      
          return makeRequest(
            `/companies/${companyName}/projects/${projectId}/files/${fileName}`,
            config,
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
        },
      
        getAll: async (projectId: string): Promise<FileResponse[]> => {
          const token = await user.getIdToken(true);
          if (!token) throw new Error('Authentication required');
      
          const url = constructApiUrl(`/companies/${companyName}/projects/${projectId}/files`);
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-company-name': companyName
            }
          });
      
          if (!response.ok) {
            throw new Error('Failed to fetch files');
          }
      
          const rawData = await response.json() as FileResponse[] | ApiResponse;
          return Array.isArray(rawData) ? rawData : rawData.files || [];
        }
      }
        
      
      
      
        }
      };