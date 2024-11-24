// src/utils/organizationValidation.ts

import { isDomainRegistered } from '@/lib/firebase/firestore';

const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com'
];
/**
 * Validates if the email is a work email
 * @param email - The email address to validate
 * @returns Promise<{ isValid: boolean, message?: string }> - Validation result
 */

export const normalizeCompanyName = (email: string): string => {
  const domain = email.split('@')[1];
  return domain.split('.')[0].toLowerCase();
};


export const isWorkEmail = async (email: string): Promise<{ isValid: boolean; message?: string }> => {
  try {
    const domain = email.split('@')[1].toLowerCase();
    
    if (PERSONAL_EMAIL_DOMAINS.includes(domain)) {
      return { 
        isValid: false, 
        message: 'Please use your work email address. Personal email addresses are not accepted.' 
      };
    }
    
    return { isValid: true };
  } catch (error) {
    console.error('Error validating work email:', error);
    return { isValid: false, message: 'Invalid email format' };
  }
};

export const getOrganizationIdFromEmail = (email: string): string => {
  try {
    return normalizeCompanyName(email);
  } catch (error) {
    console.error('Error getting organization ID:', error);
    return '';
  }
};