// src/utils/validators.ts
import validator from 'validator';

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  return validator.isEmail(email);
};

/**
 * Validate strong password
 * Requirements: min 8 chars, uppercase, lowercase, number, special char
 */
export const isStrongPassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Sanitize email
 */
export const sanitizeEmail = (email: string): string => {
  return validator.normalizeEmail(email) || email.toLowerCase().trim();
};

/**
 * Validate URL
 */
export const isValidUrl = (url: string): boolean => {
  return validator.isURL(url);
};

/**
 * Validate phone number (basic international format)
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-()]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
  return phoneRegex;
};

/**
 * Validate business name
 */
export const isValidBusinessName = (name: string): boolean => {
  return validator.isLength(name, { min: 2, max: 255 }) &&
         /^[a-zA-Z0-9\s\-'.,&()]+$/.test(name);
};

/**
 * Validate country code (2-letter ISO code)
 */
export const isValidCountryCode = (code: string): boolean => {
  return /^[A-Z]{2}$/.test(code);
};

/**
 * Sanitize string input (remove dangerous characters)
 */
export const sanitizeString = (str: string): string => {
  return validator.escape(str).trim();
};

/**
 * Validate message length
 */
export const isValidMessageLength = (message: string, min: number = 1, max: number = 10000): boolean => {
  return validator.isLength(message, { min, max });
};

/**
 * Check if value is numeric
 */
export const isNumeric = (value: any): boolean => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

/**
 * Validate JWT format
 */
export const isValidJWT = (token: string): boolean => {
  const jwtRegex = /^[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*$/;
  return jwtRegex.test(token);
};

/**
 * Validate date string (ISO format)
 */
export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Sanitize filename
 */
export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9._\-]/g, '').slice(0, 255);
};

/**
 * Validate credit card number (Luhn algorithm)
 */
export const isValidCreditCard = (cardNumber: string): boolean => {
  return validator.isCreditCard(cardNumber);
};

/**
 * Check if string contains SQL injection patterns
 */
export const hasSQLInjectionPatterns = (input: string): boolean => {
  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)/gi,
    /(\bselect\b.*\bfrom\b)/gi,
    /(\bdrop\b.*\btable\b)/gi,
    /(\binsert\b.*\binto\b)/gi,
    /(\bupdate\b.*\bset\b)/gi,
    /(\bdelete\b.*\bfrom\b)/gi,
    /(-{2}|\/\*|\*\/|xp_|sp_)/gi
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Check if string contains XSS patterns
 */
export const hasXSSPatterns = (input: string): boolean => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi
  ];

  return xssPatterns.some(pattern => pattern.test(input));
};
