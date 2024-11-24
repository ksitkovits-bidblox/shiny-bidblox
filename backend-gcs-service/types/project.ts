// backend-gcs-service/src/types/project.ts

export interface ProjectFile {
    fileName: string;
    fileUrl: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }
  
  export interface Analysis {
    content: string;
    generatedAt: string;
    fileCount: number;
  }
  
  export interface ExecutiveSummary extends Analysis {}
  
  export interface AnalysisResults {
    [questionId: string]: Analysis;
  }
  
  export interface Project {
    id: string;
    name: string;
    organization: string;
    createdAt: string;
    updatedAt: string;
    bidStatus: 'go' | 'no-go' | 'pending';
    files: ProjectFile[];
    executiveSummary?: ExecutiveSummary;
    analyses?: AnalysisResults;
  }
  
  // Request/Response types
  export interface AnalysisRequest {
    prompt: string;
    questionId: string;
    forceRegenerate?: boolean;
  }
  
  export interface AnalysisResponse {
    analysis: string;
    generatedAt: string;
    wasRegenerated: boolean;
    fileCount: number;
  }
  
  export interface ExecutiveSummaryRequest {
    forceRegenerate?: boolean;
  }
  
  export interface ExecutiveSummaryResponse {
    analysis: string;
    generatedAt: string;
    wasRegenerated: boolean;
    fileCount: number;
  }