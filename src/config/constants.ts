// src/config/constants.ts
export const ALLOWED_EMAIL_DOMAINS = [
    'company1.com',
    'company2.com',
    // Add more allowed domains
  ];
  
  // Optional: Add organization mappings
  export const ORGANIZATION_MAPPINGS = {
    'company1.com': {
      name: 'Company One',
      defaultRole: 'user',
      features: ['feature1', 'feature2']
    },
    'company2.com': {
      name: 'Company Two',
      defaultRole: 'user',
      features: ['feature1', 'feature3']
    }
  } as const;