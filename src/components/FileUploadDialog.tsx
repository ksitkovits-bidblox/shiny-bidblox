import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/utils/dropzone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';  
import { companyApi, getCompanyFromEmail } from '@/utils/api';  // Import companyApi instead

interface FileUploadDialogProps {
  onUploadComplete: () => void;
  projectId: string;
}

export const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
  onUploadComplete,
  projectId
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { user, userProfile, isAuthenticated } = useAuth();

  const api = useMemo(() => {
    if (!user || !userProfile || !isAuthenticated) return null;
    return companyApi({ user, userProfile, isAuthenticated });
  }, [user, userProfile, isAuthenticated]);

  const handleFileUpload = async (files: File[]) => {
    if (!api || !projectId || !user?.email) {
      console.log('Missing required data:', { 
        hasApi: !!api,
        projectId,
        userEmail: user?.email
      });
      setUploadError('Missing required information for upload');
      return;
    }
  
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
  
    try {
      console.log('Starting file upload:', {
        projectId,
        fileCount: files.length,
        userEmail: user.email,
        company: getCompanyFromEmail(user.email)
      });

      await api.files.upload(projectId, files);
      
      setUploadProgress(100);
      setIsOpen(false);
      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files';
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Files
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Drag and drop files here or click to browse
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DropZone
            onFilesDrop={handleFileUpload}
            isUploading={isUploading}
            progress={uploadProgress}
            maxFiles={5}
            acceptedFileTypes={[
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain',
              'text/csv'
            ]}
          />
          {uploadError && (
            <Alert variant="destructive">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}
          {isUploading && (
            <div className="text-sm text-gray-500 text-center">
              <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
              Uploading... {uploadProgress}%
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};