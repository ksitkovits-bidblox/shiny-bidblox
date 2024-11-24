import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, AlertCircle, Loader2, Mail } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from '@/lib/utils';  
import { useAuth } from '@/contexts/AuthContext';
import { companyApi, makeRequest, getCompanyFromEmail } from '@/utils/api'; 
import { Project, CreateProjectData } from '@/types/schema';
import { collection, addDoc, getDocs, getDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { normalizeCompanyName } from '@/utils/organizationValidation';





interface EmailInvitation {
  recipientEmail: string;
  message: string;
  projectId: string;
  executiveSummary?: string;
  rfpNumber?: string;
}


const Bid: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newProject, setNewProject] = useState<CreateProjectData>({
    name: '',
    organization: '',
    rfpNumber: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [emailInvitation, setEmailInvitation] = useState<EmailInvitation | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [loading, setLoading] = useState(true);  // Changed to match Proposals naming

  
  


// Initialize API client
const api = userProfile ? companyApi({ user, userProfile, isAuthenticated }) : null;

useEffect(() => {
  if (isAuthenticated && userProfile?.companyName) {
    fetchProjects();
  }
}, [isAuthenticated, userProfile?.companyName]);

const fetchProjects = async () => {
  setLoading(true);
  if (!userProfile?.companyName || !user?.email) return;
  
  try {
    const normalizedCompany = userProfile.companyName.toLowerCase();
    console.log('Fetching projects:', {
      userEmail: user.email,
      normalizedCompany
    });

    // 1. Get projects from Firestore
    const projectsRef = collection(db, 'companies', normalizedCompany, 'projects');
    const querySnapshot = await getDocs(projectsRef);
    
    // 2. Map the project documents
    const projects: Project[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        organization: data.organization,
        rfpNumber: data.rfpNumber,
        bidStatus: data.bidStatus,
        createdAt: data.createdAt,
        createdBy: data.createdBy,
        companyName: data.companyName,
        organizationID: data.organizationID,
        files: [] // Initialize empty files array
      };
    });

    // 3. Fetch files for each project if needed
    if (api) {
      for (const project of projects) {
        try {
          const files = await api.files.getAll(project.id);
          project.files = files.map(file => ({
            fileName: file.fileName,
            fileUrl: file.fileUrl,
            size: file.size,
            mimeType: file.contentType,
            uploadedAt: file.uploadedAt
          }));
        } catch (fileError) {
          console.warn('Could not fetch files for project:', {
            projectId: project.id,
            error: fileError
          });
          // Continue with empty files array if fetch fails
        }
      }
    }

    setProjects(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    setError(error instanceof Error ? error.message : 'Error fetching projects');
    } finally {
    setLoading(false);
  }
};


// Update the useEffect to not depend on userProfile
useEffect(() => {
  if (!authLoading && isAuthenticated && user?.email) {
    console.log('Auth ready, fetching projects...');
    fetchProjects();
  }
}, [authLoading, isAuthenticated, user?.email]);

// Single useEffect to handle auth state and project fetching
useEffect(() => {
  if (!authLoading && isAuthenticated && user && userProfile?.companyName) {
    console.log('Auth ready, fetching projects:', {
      company: userProfile.companyName,
      userId: user.uid
    });
    fetchProjects();
  } else {
    console.log('Waiting for auth...', {
      isAuthLoading: authLoading,
      isAuthenticated,
      hasUser: !!user,
      hasProfile: !!userProfile
    });
  }
}, [authLoading, isAuthenticated, user, userProfile]);


const fetchExecutiveSummary = async (projectId: string) => {
  if (!userProfile?.companyName || !user) return null;
  
  try {
    const projectRef = doc(db, 'companies', userProfile.companyName, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const projectData = projectSnap.data();
    return projectData.executiveSummary?.content || null;
  } catch (error) {
    console.error('Error fetching executive summary:', error);
    return null;
  }
};




const handleStatusChange = async (projectId: string, newStatus: 'go' | 'no-go' | 'pending') => {
  if (!userProfile?.companyName || !user) return;

  setUpdatingStatus(projectId);
  setError(null);

  try {
    // First, update in Firestore
    const projectRef = doc(db, 'companies', userProfile.companyName, 'projects', projectId);
    
    await setDoc(projectRef, {
      bidStatus: newStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid
    }, { merge: true });

    // Update local state
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, bidStatus: newStatus } : p
    ));

    // If status is 'go', use the existing API call for proposal creation
    if (newStatus === 'go') {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        try {
          await createProposal(project);
          console.log('Proposal created successfully for project:', projectId);
        } catch (proposalError) {
          console.error('Error creating proposal:', proposalError);
          // Don't throw here - we still want to keep the status update
        }
      }
    }

  } catch (error) {
    console.error('Status update error:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update project status';
    setError(errorMessage);
    
    // Revert optimistic update
    setProjects(prev => prev.map(project => 
      project.id === projectId 
        ? { ...project, bidStatus: project.bidStatus } 
        : project
    ));
  } finally {
    setUpdatingStatus(null);
  }
};

  // Function for sending email invitation
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInvitation || !api || !userProfile || !user) {
      console.log('Missing required data:', {
        hasEmailInvitation: !!emailInvitation,
        hasApi: !!api,
        hasUserProfile: !!userProfile,
        hasUser: !!user
      });
      return;
    }
  
    setIsSendingEmail(true);
    setError(null);
  
    try {
      console.log('Fetching project data for email:', {
        projectId: emailInvitation.projectId,
        company: userProfile.companyName
      });
  
      // Get project data with executive summary
      const projectRef = doc(db, 'companies', userProfile.companyName, 'projects', emailInvitation.projectId);
      const projectSnap = await getDoc(projectRef);
      
      if (!projectSnap.exists()) {
        throw new Error('Project not found');
      }
  
      const projectData = projectSnap.data();
      console.log('Project data retrieved:', {
        hasExecutiveSummary: !!projectData.executiveSummary?.content,
        rfpNumber: projectData.rfpNumber
      });
  
      // Prepare email data
      const emailData = {
        recipientEmail: emailInvitation.recipientEmail,
        message: emailInvitation.message,
        subject: `RFP ${projectData.rfpNumber} - Project Summary`,
        executiveSummary: projectData.executiveSummary?.content,
        type: 'subcontractor'
      };
  
      // Use the companies endpoint instead
      await makeRequest(
        `/companies/${userProfile.companyName}/mail`,
        { user, userProfile, isAuthenticated },
        {
          method: 'POST',
          body: JSON.stringify(emailData)
        }
      );
  
      setEmailInvitation(null);
    } catch (error) {
      console.error('Error sending invitation:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        projectId: emailInvitation.projectId,
        company: userProfile.companyName
      });
      setError(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setIsSendingEmail(false);
    }
  };


  const createProposal = async (project: Project) => {
    if (!userProfile?.companyName || !user) return;
  
    try {
      const proposalData = {
        projectId: project.id,
        projectName: project.name,
        organization: project.organization,
        category: 'construction',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'draft',
        company: userProfile.companyName // Include company name
      };
      
      const responseData = await makeRequest(
        `/companies/${userProfile.companyName}/proposals`,
        { user, userProfile, isAuthenticated },
        {
          method: 'POST',
          body: JSON.stringify(proposalData)
        }
      );
  
      console.log('Proposal created successfully:', responseData);
      return responseData;
    } catch (error) {
      console.error('Error creating proposal:', error);
      setError(error instanceof Error ? error.message : 'Failed to create proposal');
      throw error;
    }
  };


  const handleDeleteProject = async (project: Project) => {
    if (!userProfile?.companyName || !user) return;

    try {
      await makeRequest(
        `/companies/${userProfile.companyName}/projects/${project.id}`,
        { user, userProfile, isAuthenticated },
        {
          method: 'DELETE'
        }
      );
      
      setProjects(prev => prev.filter(p => p.id !== project.id));
      setDeleteProject(null);
    } catch (error) {
      console.error('Delete error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteProject || !userProfile?.companyName || !user) return;
    
    setIsDeleting(true);
    setError(null);
  
    try {
      await makeRequest(
        `/companies/${userProfile.companyName}/projects/${deleteProject.id}?company=${userProfile.companyName}`,
        { user, userProfile, isAuthenticated },
        { method: 'DELETE' }
      );
      setProjects(prev => prev.filter(p => p.id !== deleteProject.id));
      setDeleteProject(null);
    } catch (error) {
      console.error('Delete error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Add a timeout to prevent hanging
  useEffect(() => {
    if (isDeleting) {
      const timeout = setTimeout(() => {
        setIsDeleting(false);
        setError('Delete operation timed out. Please try again.');
      }, 5000); // 5 second timeout
  
      return () => clearTimeout(timeout);
    }
  }, [isDeleting]);




  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.companyName || !user) {
      console.log('Missing auth data:', {
        hasCompany: !!userProfile?.companyName,
        hasUser: !!user
      });
      return;
    }
    
    setIsCreating(true);
    setError(null);
  
    try {
      const projectData: Omit<Project, 'id'> = {
        name: newProject.name,
        organization: newProject.organization,
        rfpNumber: newProject.rfpNumber.trim(),
        bidStatus: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        companyName: userProfile.companyName,
        organizationID: newProject.organization.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        files: []  // Optional, but good to initialize as empty array
      };
  
      console.log('Creating project:', projectData);
  
      const projectsRef = collection(db, 'companies', userProfile.companyName, 'projects');
      
      try {
        const newProjectRef = await addDoc(projectsRef, projectData);
        console.log('Project created in Firestore:', newProjectRef.id);
        
        const newProject: Project = {
          ...projectData,
          id: newProjectRef.id
        };
        
        setProjects(prev => [...prev, newProject]);
        setNewProject({ name: '', organization: '', rfpNumber: '' });
        setIsOpen(false);
        
        navigate(`/companies/${userProfile.companyName}/projects/${newProjectRef.id}`);
      } catch (firestoreError) {
        console.error('Firestore error:', firestoreError);
        throw firestoreError;
      }
    } catch (error) {
      console.error('Error creating project:', error);
      if (error instanceof Error) {
        const message = error.message.includes('auth')
          ? 'Authentication error. Please try logging in again.'
          : error.message;
        setError(message);
      } else {
        setError('Failed to create project');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = async (projectId: string, files: FileList) => {
    if (!api || !userProfile) return;
  
    try {
      setLoading(true);
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));
  
      const result = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/companies/${userProfile.companyName}/projects/${projectId}/files`,
        {
          method: 'POST',
          body: formData
        }
      ).then(res => res.json());
  
      await fetchProjects();
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  

  const handleFileDelete = async (projectId: string, fileName: string) => {
    if (!api || !userProfile || !user) return;
  
    try {
      await makeRequest(
        `/companies/${userProfile.companyName}/projects/${projectId}/files/${fileName}`,
        { user, userProfile, isAuthenticated },
        { method: 'DELETE' }
      );
      await fetchProjects();
    } catch (error) {
      console.error('Delete file error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete file');
    }
  };

  const handleFileDownload = async (projectId: string, fileName: string) => {
    if (!userProfile?.companyName || !user) {
      console.log('Missing required data:', {
        hasCompany: !!userProfile?.companyName,
        hasUser: !!user
      });
      return;
    }
  
    // Declare the anchor element outside try block so it's accessible in finally
    let downloadLink: HTMLAnchorElement | null = null;
  
    try {
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) {
        throw new Error('API initialization failed');
      }
  
      console.log('Downloading file:', { projectId, fileName });
      
      const blob = await api.files.download(projectId, fileName);
      
      // Validate blob
      if (!(blob instanceof Blob)) {
        throw new Error('Invalid response format from server');
      }
  
      // Create object URL from blob
      const url = window.URL.createObjectURL(blob);
      
      // Create and trigger download
      downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = fileName;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      console.log('File download completed');
  
      // Cleanup
      window.URL.revokeObjectURL(url);
  
    } catch (error) {
      console.error('Download error:', error);
      if (error instanceof Error) {
        const message = error.message.includes('auth')
          ? 'Authentication error. Please try logging in again.'
          : error.message;
        setError(message);
      } else {
        setError('Failed to download file');
      }
    } finally {
      // Clean up the download link if it exists
      if (downloadLink && document.body.contains(downloadLink)) {
        // Use setTimeout to ensure the download starts before removing the element
        setTimeout(() => {
          if (downloadLink && document.body.contains(downloadLink)) {
            document.body.removeChild(downloadLink);
          }
        }, 100);
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }


  return (
    <DashboardLayout>
      

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Bid Management</h1>
        {/* Email Invitation Dialog */}
          <Dialog 
          open={!!emailInvitation} 
          onOpenChange={(open) => !open && setEmailInvitation(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Subcontractor</DialogTitle>
              <DialogDescription>
                Send an invitation email with the executive summary to a subcontractor.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendInvitation} className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="recipientEmail">Subcontractor Email</Label>
      <Input
        id="recipientEmail"
        type="email"
        value={emailInvitation?.recipientEmail || ''}
        onChange={e => setEmailInvitation(prev => prev ? {
          ...prev,
          recipientEmail: e.target.value
        } : null)}
        placeholder="Enter email address"
        required
        disabled={isSendingEmail}
      />
              </div>
              
              <div className="space-y-2">
      <Label htmlFor="message">Additional Message (Optional)</Label>
      <Textarea
        id="message"
        value={emailInvitation?.message || ''}
        onChange={e => setEmailInvitation(prev => prev ? {
          ...prev,
          message: e.target.value
        } : null)}
        placeholder="Add a personal message to the invitation"
        disabled={isSendingEmail}
      />
    </div>

    {emailInvitation?.executiveSummary ? (
      <div className="space-y-2">
        <Label>Executive Summary Preview</Label>
        <div className="rounded-md bg-muted p-4 text-sm">
          {emailInvitation.executiveSummary}
        </div>
      </div>
    ) : (
      <Alert>
        <AlertDescription>
          No executive summary available. The email will only include your message.
        </AlertDescription>
      </Alert>
    )}

    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={() => setEmailInvitation(null)}
        disabled={isSendingEmail}
      >
        Cancel
      </Button>
      <Button 
        type="submit"
        disabled={isSendingEmail}
      >
        {isSendingEmail ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          'Send Invitation'
        )}
      </Button>
    </DialogFooter>
  </form>
          </DialogContent>
        </Dialog>


          <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4">
<div className="space-y-2">
  <Label htmlFor="rfpNumber">RFP Number</Label>
  <Input
    id="rfpNumber"
    value={newProject.rfpNumber}
    onChange={e => {
      // Allow typing with spaces, don't trim here
      console.log('RFP Input change:', e.target.value); // Log input changes
      setNewProject(prev => {
        const updated = { ...prev, rfpNumber: e.target.value };
        console.log('Updated project state:', updated); // Log state updates
        return updated;
      });
    }}
    onBlur={e => {
      console.log('RFP Input blur:', e.target.value); // Log blur events
      const value = e.target.value.trim();
      setNewProject(prev => ({ ...prev, rfpNumber: value }));
    }}
    placeholder="Enter RFP number"
    required
    disabled={isCreating}
    className={error && !newProject.rfpNumber ? "border-red-500" : ""}
  />
  {error && !newProject.rfpNumber && (
    <p className="text-sm text-red-500">RFP Number is required</p>
  )}
</div>

              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={newProject.name}
                  onChange={e => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter project name"
                  required
                  disabled={isCreating}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  value={newProject.organization}
                  onChange={e => setNewProject(prev => ({ ...prev, organization: e.target.value }))}
                  placeholder="Enter organization name"
                  required
                  disabled={isCreating}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
          </DialogContent>
        </Dialog>

          <Dialog open={!!deleteProject} onOpenChange={(open) => !open && setDeleteProject(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteProject?.name}"? This action cannot be undone.
                All files associated with this project will also be deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteProject(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Project'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>



        </div>

        {/* Error display for fetch errors */}
        {error && !isCreating && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

         {/* Projects Table */}
         <div className="rounded-md border border-gray-100 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold text-gray-900">RFP No.</TableHead>
                <TableHead className="font-semibold text-gray-900">Project Name</TableHead>
                <TableHead className="font-semibold text-gray-900">Organization</TableHead>
                <TableHead className="font-semibold text-gray-900">Created</TableHead>
                <TableHead className="font-semibold text-gray-900">Bid Status</TableHead>
                <TableHead className="text-right font-semibold text-gray-900">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {!loading && projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No projects yet. Create your first project to get started.
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">  {project.rfpNumber || 'No RFP Number'}</TableCell>
                    <TableCell>{project.name}</TableCell>
                    <TableCell>{project.organization}</TableCell>
                    <TableCell>{new Date(project.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                    
                    <Select
        value={project.bidStatus}
        onValueChange={(value: 'go' | 'no-go' | 'pending') => handleStatusChange(project.id, value)}
        disabled={updatingStatus === project.id}
      >
        <SelectTrigger 
          className={cn(
            "w-[100px]",
            project.bidStatus === 'go' && "text-green-600",
            project.bidStatus === 'no-go' && "text-red-600",
            project.bidStatus === 'pending' && "text-yellow-600"
          )}
        >
          {updatingStatus === project.id ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            </div>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="go" className="text-green-600">Go</SelectItem>
          <SelectItem value="no-go" className="text-red-600">No-Go</SelectItem>
          <SelectItem value="pending" className="text-yellow-600">Pending</SelectItem>
        </SelectContent>
      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/companies/${userProfile?.companyName}/projects/${project.id}?company=${userProfile?.companyName}`)}                        >
                          View
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEmailInvitation({
                            projectId: project.id,
                            recipientEmail: '',
                            message: ''
                          })}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProject(project)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
      </div>
    </DashboardLayout>
  );
};

export default Bid;