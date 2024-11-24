import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { FileIcon, TrashIcon, DownloadIcon, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { companyApi, FileResponse } from '@/utils/api';
import { cn } from "@/lib/utils";

type CategoryKey = 'companyData' | 'historicalRfps' | 'historicalProposals';

const LibraryFiles = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, userProfile, isAuthenticated } = useAuth();
  const [files, setFiles] = useState<FileResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('companyData');
  const [isDeletingFile, setIsDeletingFile] = useState<string | null>(null);

  const categories = {
    companyData: { title: "Company Data", folder: "company-data" },
    historicalRfps: { title: "Historical RFPs", folder: "historical-rfps" },
    historicalProposals: { title: "Historical Proposals", folder: "historical-proposals" }
  };

  const validateUserContext = () => {
    if (!user?.email) {
      throw new Error('User email is missing');
    }
    if (!userProfile?.companyName) {
      throw new Error('Company name is missing');
    }
    if (!isAuthenticated) {
      throw new Error('User is not authenticated');
    }
  };

  const fetchFiles = async (category: CategoryKey) => {
    setIsLoading(true);
    setError(null);
  
    try {
      validateUserContext();
      
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
      
      console.log('Fetching files for category:', {
        category,
        projectId: categories[category].folder,
        companyName: userProfile?.companyName
      });
  
      const response = await api.files.getAll(categories[category].folder);
      setFiles(response);
    } catch (error) {
      console.error('Error fetching files:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch files');
      toast({
        variant: "destructive",
        description: `Failed to fetch files: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      validateUserContext();
      
      if (!userProfile?.companyName || !isAuthenticated || !user) {
        console.error('Missing required data:', {
          hasCompany: !!userProfile?.companyName,
          isAuthenticated,
          hasUser: !!user
        });
        return;
      }
  
      console.log('Initiating download:', {
        fileName,
        projectId: categories[selectedCategory].folder,
        companyName: userProfile.companyName
      });
  
      // Create URL for the download
      const token = await user.getIdToken();
      const baseUrl = import.meta.env.VITE_BACKEND_URL;
      const url = `${baseUrl}/api/companies/${userProfile.companyName}/projects/${categories[selectedCategory].folder}/files/${fileName}/download`;
  
      // Fetch with proper headers
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-company-name': userProfile.companyName
        }
      });
  
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }
  
      // Get filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('content-disposition');
      const serverFileName = contentDisposition
        ? contentDisposition.split('filename="')[1].split('"')[0]
        : fileName;
  
      // Create blob from response
      const blob = await response.blob();
      const url2 = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url2;
      link.download = serverFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url2);
  
      toast({
        description: 'File downloaded successfully'
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: "destructive",
        description: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };
  
  const handleDelete = async (fileName: string) => {
    if (!userProfile?.companyName) {
      console.error('Company name missing');
      return;
    }
  
    console.log('Delete request:', {
      fileName,
      companyName: userProfile.companyName,
      category: selectedCategory,
      folder: categories[selectedCategory].folder
    });
  
    setIsDeletingFile(fileName);
    try {
      validateUserContext();
      
      const api = companyApi({ user, userProfile, isAuthenticated });
      if (!api) throw new Error('API initialization failed');
      
      console.log('Deleting file:', {
        fileName,
        projectId: categories[selectedCategory].folder,
        companyName: userProfile?.companyName
      });
  
      await api.files.delete(
        categories[selectedCategory].folder, // Use the folder as projectId
        fileName
      );
      
      await fetchFiles(selectedCategory);
      toast({
        description: 'File deleted successfully'
      });
    } catch (error) {
      console.error('Delete error:', {
        error,
        fileName,
        category: selectedCategory,
        folder: categories[selectedCategory].folder
      });
      toast({
        variant: "destructive",
        description: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsDeletingFile(null);
    }
  };


  useEffect(() => {
    fetchFiles(selectedCategory);
  }, [selectedCategory, user, userProfile, isAuthenticated]);

  return (
    <DashboardLayout>
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/library')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Library
              </Button>
              <h1 className="text-2xl font-bold">Library Files</h1>
            </div>
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as CategoryKey)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="companyData">Company Data</SelectItem>
                <SelectItem value="historicalRfps">Historical RFPs</SelectItem>
                <SelectItem value="historicalProposals">Historical Proposals</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border border-gray-100 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">File Name</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Size</TableHead>
                  <TableHead className="font-semibold">Uploaded</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No files found in {categories[selectedCategory].title}
                    </TableCell>
                  </TableRow>
                ) : (
                  files.map((file) => (
                    <TableRow key={file.fileName} className="hover:bg-gray-50">
                      <TableCell className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{file.fileName}</span>
                      </TableCell>
                      <TableCell className="text-gray-600">{file.contentType}</TableCell>
                      <TableCell className="text-gray-600">{Math.round(file.size / 1024)} KB</TableCell>
                      <TableCell className="text-gray-600">{new Date(file.uploadedAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file.fileName)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <DownloadIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(file.fileName)}
                            disabled={isDeletingFile === file.fileName}
                            className={cn(
                              "text-red-600 hover:text-red-700 hover:bg-red-50",
                              isDeletingFile === file.fileName && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isDeletingFile === file.fileName ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
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

export default LibraryFiles;