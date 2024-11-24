// src/types/organization.ts
export type UserRole = "user" | "admin";


export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;          // Add this
  lastName: string;           // Add this
  displayName?: string;
  organizationId: string;
  role: 'admin' | 'user';
  department?: string;
  verified: boolean;
  createdAt: Date;
  verifiedAt?: Date;
  lastLogin?: Date;
  profileCompleted?: boolean;
  onboardingCompleted?: boolean;
  updatedAt?: Date;
  companyName: string;
  businessType?: 'general-contractor' | 'architect' | 'mep-consultant' | 'sub-consultant';
  signUpCompleted?: boolean;  // Add this line
        
}

export interface Organization {
  id: string;
  name: string;
  domain: string;
  createdAt: Date;
  settings: OrganizationSettings;
  administrators: string[]; // Array of user IDs
}

export interface OrganizationSettings {
  allowedFeatures: string[];
  privacyLevel: 'strict' | 'moderate' | 'open';
  allowedDomains?: string[];
  maxUsers?: number;
  departments?: string[];
}

export interface Department {
  id: string;
  name: string;
  organizationId: string;
  head?: string; // User ID of department head
  createdAt: Date;
}