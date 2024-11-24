// src/lib/firebase/types.ts
export interface ProjectAnalysis {
    content: string;
    generatedAt: string;
    fileCount: number;
  }
  
  export interface ProjectFile {
    fileName: string;
    fileUrl: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }
  
  export interface Project {
    id: string;
    name: string;
    organization: string;
    createdAt: string;
    files: ProjectFile[];
    aiAnalysis?: ProjectAnalysis;
  }