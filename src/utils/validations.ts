// src/utils/validations.ts
export const validateCompanyName = (name: string): { 
    isValid: boolean; 
    message?: string 
  } => {
    // Remove extra spaces and check length
    const trimmedName = name.trim();
    
    if (trimmedName.length === 0) {
      return {
        isValid: false,
        message: 'Company name is required'
      };
    }
  
    if (trimmedName.length < 2) {
      return {
        isValid: false,
        message: 'Company name must be at least 2 characters long'
      };
    }
  
    if (trimmedName.length > 100) {
      return {
        isValid: false,
        message: 'Company name cannot exceed 100 characters'
      };
    }
  
    // Check for valid characters
    const validNameRegex = /^[a-zA-Z0-9\s.,&'-]+$/;
    if (!validNameRegex.test(trimmedName)) {
      return {
        isValid: false,
        message: 'Company name contains invalid characters. Only letters, numbers, spaces, and basic punctuation (.,&\'-) are allowed'
      };
    }
  
    // Check for common business suffixes
    const commonSuffixes = ['inc', 'llc', 'ltd', 'corp', 'corporation'];
    const nameLower = trimmedName.toLowerCase();
    const hasSuffix = commonSuffixes.some(suffix => 
      nameLower.includes(` ${suffix}`) || 
      nameLower.includes(`${suffix}.`)
    );
  
    // This is a warning rather than an error
    if (!hasSuffix) {
      return {
        isValid: true,
        message: 'Consider adding your business suffix (e.g., Inc., LLC, Ltd.)'
      };
    }
  
    return { isValid: true };
  };