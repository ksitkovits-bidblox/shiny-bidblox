// src/types/project.ts

// File-related types
export interface ProjectFile {
  fileName: string;  // Use fileName consistently
  fileUrl: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface AnalysesState {
  [key: string]: Analysis;
}

// Analysis-related types
export interface Analysis {
  content: string;
  generatedAt: string;
  fileCount: number;
  normalizedCompany: string; 

}

// Executive Summary has same structure as Analysis
export interface ExecutiveSummary extends Analysis {}

// Analysis results are a map of Analysis objects
export interface AnalysisResults {
  [questionId: string]: Analysis;
}

// Project data structure
export interface ProjectData {
  id: string;
  name: string;
  organization: string;
  createdAt: string;
  updatedAt: string;
  bidStatus: 'go' | 'no-go' | 'pending';
  files: ProjectFile[];
  executiveSummary?: ExecutiveSummary;
  analyses?: AnalysisResults;
  normalizedCompany: string; // Add this

}

// Analysis question structure
export interface AnalysisQuestion {
  id: string;
  label: string;
  prompt: string;
}

// API response types
export interface AnalysisResponse {
  analysis: string;
  generatedAt: string;
  wasRegenerated: boolean;
  fileCount: number;
  normalizedCompany: string; // Add this

}

// Add request types for better type safety
export interface AnalysisRequest {
  prompt: string;
  questionId: string;
  forceRegenerate?: boolean;
  normalizedCompany: string; // Add this

}



export interface ExecutiveSummaryRequest {
  forceRegenerate?: boolean;
  normalizedCompany: string; // Add this

}

// Add types for creating/updating projects
export interface CreateProjectData {
  name: string;
  organization: string;
  normalizedCompany: string; // Add this

}

export interface UpdateProjectData {
  name?: string;
  organization?: string;
  bidStatus?: 'go' | 'no-go' | 'pending';
  files?: ProjectFile[];
}