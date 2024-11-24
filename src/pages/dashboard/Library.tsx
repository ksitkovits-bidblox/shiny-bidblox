import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, FolderOpen, CircleHelp, Shield, FileQuestion } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropZone } from '@/utils/dropzone';

type CategoryKey = 'companyData' | 'historicalRfps' | 'historicalProposals';

interface Category {
  title: string;
  description: string;
  folder: string;
  acceptedTypes: string[];
}

const Library = () => {
  const { toast } = useToast();
  const navigate = useNavigate(); // Initialize the hook
  const { user, userProfile, isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('companyData');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const categories: Record<CategoryKey, Category> = {
    companyData: {
      title: "Company Data",
      description: "Upload company resources including employee resumes, certifications, and project case studies.",
      folder: "company-data",
      acceptedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv']
    },
    historicalRfps: {
      title: "Historical RFPs",
      description: "Archive of past RFPs for reference and analysis.",
      folder: "historical-rfps",
      acceptedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    },
    historicalProposals: {
      title: "Historical Proposals",
      description: "Repository of past proposals to identify winning patterns.",
      folder: "historical-proposals",
      acceptedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }
  };

  const getLibraryStoragePath = (companyName: string, category: string, fileName: string = '') => {
    const path = `company-${companyName.toLowerCase()}/library/${category}/files/${fileName}`;
    return path.replace(/\/+$/, '');
  };

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (!user?.email || !userProfile?.companyName || !isAuthenticated) {
      toast({
        variant: "destructive",
        description: "Authentication required"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const currentCategory = categories[activeCategory];
      const formData = new FormData();
      
      Array.from(files).forEach((file, index) => {
        formData.append('files', file);
        formData.append(`metadata${index}`, JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          projectId: `library/${currentCategory.folder}`,
          companyName: userProfile.companyName,
          storagePath: getLibraryStoragePath(
            userProfile.companyName,
            currentCategory.folder,
            file.name
          )
        }));
      });

      // Updated to match your existing route structure
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/companies/${userProfile.companyName}/projects/${currentCategory.folder}/files`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`,
            'x-company-name': userProfile.companyName,
          },
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setUploadProgress(100);
      toast({
        description: `${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded to ${currentCategory.title}`
      });

    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Upload failed"
      });
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [activeCategory, user, userProfile, isAuthenticated, toast, categories]);

  if (!isAuthenticated || !user?.email) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Knowledge Library</h1>
            <p className="text-gray-500 mt-1">Upload and manage your organization's documents</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/library/files')}>
  <FolderOpen className="mr-2 h-4 w-4" />
  View All Documents
</Button>
        </div>

        <div className="text-sm text-gray-500 flex items-center gap-2">
        <FileQuestion className="h-4 w-4" />
        <span>Files may be processed for AI analysis after upload in order to improve your AI-generated results. All documents are stored securely.</span>
      </div>

        <Card>
          <CardHeader>
            <Tabs defaultValue="companyData" className="w-full" onValueChange={(value) => setActiveCategory(value as CategoryKey)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="companyData">Company Data</TabsTrigger>
                <TabsTrigger value="historicalRfps">Historical RFPs</TabsTrigger>
                <TabsTrigger value="historicalProposals">Historical Proposals</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <CardTitle>{categories[activeCategory].title}</CardTitle>
                <CardDescription className="mt-2">
                  {categories[activeCategory].description}
                </CardDescription>
              </div>

              <DropZone
                onFilesDrop={handleFileUpload}
                isUploading={isUploading}
                progress={uploadProgress}
                maxFiles={10}
                acceptedFileTypes={categories[activeCategory].acceptedTypes}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Library;