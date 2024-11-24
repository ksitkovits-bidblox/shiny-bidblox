//src/pages/dashboard/projectDetails
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Trash2, Loader2, Search as SearchIcon, Sparkles, BookOpenText, CheckCheck, Copy } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUploadDialog } from '@/components/FileUploadDialog';
import { makeRequest, companyApi, getCompanyFromEmail } from '@/utils/api'; 
import FormattedAnalysis from '@/components/FormattedAnalysis';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


interface ProjectFile {
  fileName: string;
  fileUrl: string;
  size: number;
  contentType: string;  // Changed from mimeType
  uploadedAt: string;
}

type ProjectDetailsParams = {
  id?: string;
};

interface ExecutiveSummary {
  content: string;
  generatedAt: string;
  fileCount: number;
}

interface ProjectMetadata {
  id: string;
  name: string;
  organization: string;
  companyName: string; 
  createdAt: string;
  files: ProjectFile[];
  executiveSummary?: ExecutiveSummary;
}

interface FileUploadResponse {
  fileName: string;
  fileUrl: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}




const ProjectDetails: React.FC = () => {
  const { id } = useParams<keyof ProjectDetailsParams>();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
const [copySuccess, setCopySuccess] = useState(false);
  const { user, userProfile, isAuthenticated } = useAuth();
  const api = useMemo(() => {
    if (!userProfile?.companyName || !user || !isAuthenticated) {
      return null;
    }
    return companyApi({ user, userProfile, isAuthenticated });
  }, [user, userProfile?.companyName, isAuthenticated]);




 // Security: Verify company access
 const verifyCompanyAccess = (data: ProjectMetadata): boolean => {
  if (!user?.email) return false;
  
  const companyName = getCompanyFromEmail(user.email);
  const hasAccess = data.companyName === companyName;
  
  if (!hasAccess) {
    console.error('Security violation: Attempted cross-company access', {
      requestedCompany: data.companyName,
      derivedCompany: companyName,
      userEmail: user?.email,
      projectId: id,
      timestamp: new Date().toISOString()
    });
    setLoadError('Unauthorized: You do not have access to this project');
    navigate('/dashboard');
  }
  return hasAccess;
};

  
  const loadProject = async () => {
    if (!userProfile?.companyName || !user || !id || !api) {
      return;
    }

    try {
      const projectData = await api.projects.get(id);

      if (projectData.companyName !== userProfile.companyName) {
        throw new Error('Unauthorized access');
      }

      setProjectMetadata(projectData);
      if (projectData.executiveSummary?.content) {
        setExecutiveSummary(projectData.executiveSummary.content);
      }
      setLoadError(null);
    } catch (error) {
      console.error('Error fetching project:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load project data');
      setProjectMetadata(null);
      setExecutiveSummary(null);
    }
  };

  const fetchProject = useCallback(async (signal?: AbortSignal) => {
    if (!user?.email || !id) {
      console.log('Missing requirements:', {
        userEmail: user?.email,
        projectId: id
      });
      return;
    }
      
    setIsLoading(true);
    setLoadError(null);
      
    try {
      const companyName = getCompanyFromEmail(user.email);
          
      // Get project from Firestore
      const projectRef = doc(db, 'companies', companyName, 'projects', id);
      const projectSnap = await getDoc(projectRef);
          
      if (!projectSnap.exists()) {
        throw new Error('Project not found');
      }
        
      const firestoreData = projectSnap.data();
      const projectData = {
        id: projectSnap.id,
        name: firestoreData.name,
        organization: firestoreData.organization,
        companyName: firestoreData.companyName,
        createdAt: firestoreData.createdAt,
        files: [], // Initialize empty files array
        executiveSummary: firestoreData.executiveSummary
      } as ProjectMetadata;
        
      // Verify company access
      if (!verifyCompanyAccess(projectData)) {
        return;
      }
        
      console.log('Project found in Firestore:', projectData);
        
      // Fetch files if API client exists
      if (api) {
        try {
          console.log('Fetching files for project:', {
            projectId: id,
            company: companyName
          });
                  
          const files = await api.files.getAll(id);
          console.log('Files retrieved:', {
            count: files.length,
            files: files.map((f: ProjectFile) => ({
              name: f.fileName,
              size: f.size
            }))
          });
          
          projectData.files = files;
          
        } catch (fileError) {
          console.error('Failed to fetch files:', {
            error: fileError,
            projectId: id,
            company: companyName
          });
          projectData.files = [];
        }
      }
        
      setProjectMetadata(projectData);
      if (projectData.executiveSummary?.content) {
        setExecutiveSummary(projectData.executiveSummary.content);
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Error fetching project:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load project data');
      setProjectMetadata(null);
      setExecutiveSummary(null);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [id, user, api]); // Add dependencies here

  // Use fetchProject in useEffect
  useEffect(() => {
    if (!userProfile?.companyName || !user || !id) return;
    
    const abortController = new AbortController();
    fetchProject(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchProject, userProfile?.companyName, user, id]);



  // Make sure file upload completion handler is typed
  const handleFileUploadComplete = async (): Promise<void> => {
    console.log('File upload complete, refreshing project data...');
    if (!isLoading) {
      await fetchProject();
    }
    console.log('Project data refresh complete');
  };
  

  // Single useEffect for data fetching
  useEffect(() => {
    if (!userProfile?.companyName || !user || !id) return;
    
    const abortController = new AbortController();
    fetchProject(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [id, userProfile?.companyName, user]);
    
  

  const fetchProjectData = async (signal?: AbortSignal) => {
    if (!api || !id || !userProfile?.companyName) return;

    try {
      const projectData = await api.projects.get(id);
      
      // Security: Verify company access before setting any data
      if (!verifyCompanyAccess(projectData)) {
        return;
      }

      setProjectMetadata(projectData);
      if (projectData.executiveSummary?.content) {
        setExecutiveSummary(projectData.executiveSummary.content);
      }
      setLoadError(null);
    } catch (error) {
      if (signal?.aborted) return;
      
      console.error('Error fetching project:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load project data');
      // Security: Clear sensitive data on error
      setProjectMetadata(null);
      setExecutiveSummary(null);
    }
  };


  

  const generateExecutiveSummary = async () => {
    if (!user?.email || !id || !api) {
      console.log('Missing required data:', {
        hasEmail: !!user?.email,
        hasId: !!id,
        hasApi: !!api
      });
      return;
    }
    
    setIsSummaryLoading(true);
    setUploadError(null);
  
    try {
      const response = await api.projects.generateExecutiveSummary(id, true);
  
      console.log('Executive summary response:', response);
  
      setExecutiveSummary(response.analysis);
      
      // No need to manually update metadata - the server handles this now
      if (response.wasRegenerated) {
        await fetchProject(); // Optional refresh if needed
      }
  
    } catch (error) {
      console.error('Summary generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId: id,
        userEmail: user.email,
        stack: error instanceof Error ? error.stack : undefined
      });
      setUploadError(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  

  const handleAnalyze = () => {
    if (!id) {
      console.error('Missing project ID for navigation');
      return;
    }
    
    const analysisPath = `/project/${id}/analyze`;
    console.log('Navigating to analysis:', analysisPath);
    navigate(analysisPath);
  };
  


const handleFileUpload = async (files: File[]) => {
  if (!id || !user?.email || !projectMetadata) {
    console.log('Missing required data for upload:', {
      hasId: !!id,
      userEmail: user?.email,
      hasProjectMetadata: !!projectMetadata
    });
    setUploadError('Missing required information for upload');
    return;
  }

  if (!verifyCompanyAccess(projectMetadata)) {
    return;
  }

  setIsUploading(true);
  setUploadProgress(0);
  setUploadError(null);

  try {
    if (!api) {
      throw new Error('API client not initialized');
    }

    console.log('Starting file upload with company context:', {
      companyName: getCompanyFromEmail(user.email),
      userEmail: user.email,
      projectId: id,
      fileCount: files.length
    });

    const result = await api.files.upload(id, files);
    await fetchProject();
    setUploadProgress(100);
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 
      typeof error === 'string' ? error :
      error instanceof Object && 'error' in error ? (error as any).error :
      'Failed to upload files';
    
    setUploadError(errorMessage);
  } finally {
    setIsUploading(false);
  }
};




  
  // The regenerate button click handler explicitly regenerates the summary
const handleRegenerateSummary = () => {
  generateExecutiveSummary();
};

const handleFileDownload = async (fileName: string) => {
  if (!id || !api) return;
  
  try {
    // Get the file blob directly instead of signed URL
    const response = await api.files.getContent(id, fileName);
    const blob = await response.blob();
    
    // Create URL and trigger download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName; // Changed from setAttribute
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download failed:', error);
    // Consider adding toast notification here
  }
};

const handleDeleteFile = async (fileName: string) => {
  if (!id || !projectMetadata || !userProfile?.companyName) return;

  if (!verifyCompanyAccess(projectMetadata)) {
    return;
  }

  try {
    await api?.files.delete(id, fileName);
    await fetchProject(); // Refresh from Firestore
  } catch (error) {
    console.error('Delete error:', error);
    setUploadError(error instanceof Error ? error.message : 'Failed to delete file');
  }
};


  const handleBatchDelete = async () => {
    if (!userProfile || !user || !id || !projectMetadata || !selectedFileIds.length) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedFileIds.length} files?`)) return;

    try {
      await makeRequest(`/companies/${userProfile?.companyName}/projects/${id}/files`, 
      { user, userProfile, isAuthenticated },
      {
        method: 'DELETE',
        body: JSON.stringify({ fileIds: selectedFileIds }),
      });

      setProjectMetadata(prev => prev ? {
        ...prev,
        files: prev.files.filter(file => !selectedFileIds.includes(file.fileName))
      } : null);
      setSelectedFileIds([]);
    } catch (error) {
      console.error('Batch delete error:', error);
      setUploadError('Failed to delete files');
    }
  };

  const handleCopySummary = async () => {
    if (!executiveSummary) return;
    
    try {
      setIsCopying(true);
      const formattedSummary = executiveSummary
        .split('\n')
        .map(line => line.trim())
        .join('\n\n');
      
      await navigator.clipboard.writeText(formattedSummary);
      setCopySuccess(true);
      
      // Reset success state after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy summary:', error);
    } finally {
      setIsCopying(false);
    }
  };



  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!projectMetadata) return;
    setSelectedFileIds(event.target.checked ? projectMetadata.files.map(file => file.fileName) : []);
  };

  const handleSelectFile = (fileName: string) => {
    setSelectedFileIds(prev => 
      prev.includes(fileName) 
        ? prev.filter(id => id !== fileName)
        : [...prev, fileName]
    );
  };

  const executiveSummaryCard = (
    <Card className="shadow-sm">
    <CardHeader className="pb-2">
      <div className="flex justify-between items-center">
        <CardTitle>Executive Summary</CardTitle>
        {executiveSummary && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isCopying}
            onClick={async () => {
              if (!executiveSummary) return;
              
              try {
                setIsCopying(true);
                const formattedSummary = executiveSummary
                  .split('\n')
                  .map(line => line.trim())
                  .join('\n\n');
                
                await navigator.clipboard.writeText(formattedSummary);
                setCopySuccess(true);
                
                setTimeout(() => {
                  setCopySuccess(false);
                }, 2000);
              } catch (error) {
                console.error('Failed to copy summary:', error);
              } finally {
                setIsCopying(false);
              }
            }}
            title="Copy summary" // Adds tooltip on hover
          >
            {copySuccess ? (
              <CheckCheck className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </CardHeader>
    <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 pb-4">
            {projectMetadata && (
              <>
                <div>
                  <p className="font-medium text-gray-900">Created</p>
                  <p className="text-gray-600">
                    {new Date(projectMetadata.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Total Files</p>
                  <p className="text-gray-600">{projectMetadata.files.length}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Organization</p>
                  <p className="text-gray-600">{projectMetadata.organization}</p>
                </div>
              </>
            )}
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-medium text-gray-900"></h3>
              {!isSummaryLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateSummary}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate
                </Button>
              )}
            </div>
            
            {isSummaryLoading ? (
              <div className="flex items-center justify-center space-x-3 p-12 bg-muted/50 rounded-lg border border-border/50">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-gray-600">Analyzing documents...</span>
              </div>
            ) : executiveSummary ? (
              <FormattedAnalysis content={executiveSummary} />
            ) : (
              <div className="flex items-center justify-center p-12 text-center bg-muted/50 rounded-lg border border-border/50">
                <span className="text-gray-500">
                  No summary available. Click "Generate" to analyze the documents.
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          Loading project details...
        </div>
      </DashboardLayout>
    );
  }

  if (!projectMetadata) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertDescription>Failed to load project details</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Project Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{projectMetadata.name}</h1>
            <p className="text-sm text-gray-500">Organization: {projectMetadata.organization}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500"></div>
            <Button
              onClick={handleAnalyze}
              variant="default"
              className="flex items-center gap-2"
            >
              <BookOpenText className="h-4 w-4" />
              Analyze Project
            </Button>
          </div>
        </div>

        {/* Executive Summary Card */}
        {executiveSummaryCard}

        {/* Project Files Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Project Files</CardTitle>
              <FileUploadDialog 
  projectId={id!} 
  onUploadComplete={handleFileUploadComplete} 
/>
            </div>
          </CardHeader>
          <CardContent>
            {uploadError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}

            {isUploading && (
              <div className="mb-4">
                <div className="h-2 bg-gray-200 rounded">
                  <div 
                    className="h-full bg-blue-600 rounded" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <div className="rounded-md border border-gray-100 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={selectedFileIds.length === projectMetadata.files.length && projectMetadata.files.length > 0}
                        disabled={projectMetadata.files.length === 0}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectMetadata.files.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        No files uploaded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    projectMetadata.files.map((file) => (
                      <TableRow key={file.fileName}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedFileIds.includes(file.fileName)}
                            onChange={() => handleSelectFile(file.fileName)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span>{file.fileName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(file.uploadedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{formatFileSize(file.size)}</TableCell>
                        <TableCell>{file.contentType}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                              <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFileDownload(file.fileName)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFile(file.fileName)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {selectedFileIds.length > 0 && (
              <div className="flex justify-end space-x-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedFileIds([])}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBatchDelete}
                >
                  Delete Selected ({selectedFileIds.length})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

// Helper function to format file sizes
const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export default ProjectDetails;