import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFilesDrop: (files: File[]) => void;
  isUploading: boolean;
  progress?: number;
  maxFiles?: number;
  acceptedFileTypes?: string[];
}

// File type mapping for display
const fileTypeMap: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'text/plain': 'TXT',
  'text/csv': 'CSV'
};

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesDrop,
  isUploading,
  progress = 0,
  maxFiles = 5,
  acceptedFileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Handle accepted files
    const newFiles = acceptedFiles.slice(0, maxFiles - selectedFiles.length);
    setSelectedFiles(prev => [...prev, ...newFiles].slice(0, maxFiles));

    // Handle rejected files
    const errors = rejectedFiles.map(({ file, errors }) => {
      const errorMessages = errors.map(error => {
        switch (error.code) {
          case 'file-too-large':
            return `${file.name} is too large (max 10MB)`;
          case 'file-invalid-type':
            return `${file.name} has an invalid file type`;
          case 'too-many-files':
            return `Maximum ${maxFiles} files allowed`;
          default:
            return `${file.name}: ${error.message}`;
        }
      });
      return errorMessages;
    }).flat();

    setFileErrors(errors);
  }, [maxFiles, selectedFiles.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    accept: acceptedFileTypes.reduce((acc, curr) => ({ ...acc, [curr]: [] }), {}),
    maxSize: 10 * 1024 * 1024, // 10MB max file size
    disabled: isUploading
  });

  const removeFile = (name: string) => {
    setSelectedFiles(files => files.filter(file => file.name !== name));
    setFileErrors([]);
  };

  const handleUpload = () => {
    onFilesDrop(selectedFiles);
    setSelectedFiles([]);
    setFileErrors([]);
  };

  const getFileTypeDisplay = (file: File): string => {
    return fileTypeMap[file.type] || file.type.split('/')[1].toUpperCase();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragActive ? "border-primary bg-primary/10" : "border-gray-300 hover:bg-gray-50",
          isUploading && "opacity-50 cursor-not-allowed",
          !isUploading && "cursor-pointer"
        )}
      >
        <input {...getInputProps()} disabled={isUploading} />
        <Upload 
          className={cn(
            "h-10 w-10 mx-auto mb-4",
            isDragActive ? "text-primary" : "text-gray-400"
          )} 
        />
        {isDragActive ? (
          <p className="text-primary font-medium">Drop the files here...</p>
        ) : (
          <div>
            <p className="font-medium">Drag & drop files here, or click to select files</p>
            <p className="text-sm text-gray-500 mt-1">
              Maximum {maxFiles} files (10MB each)
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Accepted types: {Object.values(fileTypeMap).join(', ')}
            </p>
          </div>
        )}
      </div>

      {fileErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {fileErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Selected Files ({selectedFiles.length}/{maxFiles})</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedFiles([]);
                setFileErrors([]);
              }}
              disabled={isUploading}
            >
              Clear All
            </Button>
          </div>
          
          <div className="border rounded-lg divide-y">
            {selectedFiles.map(file => (
              <div key={file.name} className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <File className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {getFileTypeDisplay(file)} • {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file.name)}
                  disabled={isUploading}
                  className="flex-shrink-0 ml-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
              className="min-w-[100px]"
            >
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </Button>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-center text-gray-500">
            Uploading... {progress}%
          </p>
        </div>
      )}
    </div>
  );
};