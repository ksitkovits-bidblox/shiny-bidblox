// src/types/schema.ts
export interface Project {
  id: string;
  name: string;
  organization: string;
  rfpNumber: string;
  bidStatus: 'go' | 'no-go' | 'pending';
  createdAt: string;
  createdBy: string;
  companyName: string;
  organizationID: string;
  files?: {
    fileName: string;
    fileUrl: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }[];
}

interface ProjectAnalysis {
  questionId: string;     // e.g. 'summary', 'requirements'
  content: string;        // The analysis text
  generatedAt: string;    // Timestamp
  fileCount: number;      // Number of files analyzed
}

export interface AnalysisRequest {
  prompt: string;
  questionId: string;
  forceRegenerate?: boolean;
  normalizedCompany: string;
}


export type CreateProjectData = Pick<Project, 'name' | 'organization' | 'rfpNumber'>;

export type UpdateProjectData = Partial<Omit<Project, 'id' | 'createdAt' | 'createdBy' | 'companyName' | 'normalizedCompany'>>;
