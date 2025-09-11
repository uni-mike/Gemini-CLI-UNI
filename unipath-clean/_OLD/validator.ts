export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (emailRegex.test(email)) {
    return { isValid: true };
  }
  
  return { 
    isValid: false, 
    errorMessage: 'Invalid email format' 
  };
}