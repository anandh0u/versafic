// src/utils/string.ts
import slugify from 'slugify';

/**
 * Convert string to slug (URL-safe)
 */
export const toSlug = (str: string): string => {
  return slugify(str, { lower: true, strict: true });
};

/**
 * Capitalize first letter
 */
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Capitalize all words
 */
export const titleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Convert to camelCase
 */
export const toCamelCase = (str: string): string => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
};

/**
 * Convert to snake_case
 */
export const toSnakeCase = (str: string): string => {
  return str
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map(word => word.toLowerCase())
    .join('_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

/**
 * Truncate string with ellipsis
 */
export const truncate = (str: string, length: number = 50): string => {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
};

/**
 * Repeat string n times
 */
export const repeat = (str: string, times: number): string => {
  return str.repeat(Math.max(0, times));
};

/**
 * Check if string contains substring (case-insensitive)
 */
export const containsIgnoreCase = (str: string, substring: string): boolean => {
  return str.toLowerCase().includes(substring.toLowerCase());
};

/**
 * Remove whitespace from string
 */
export const removeWhitespace = (str: string): string => {
  return str.replace(/\s+/g, '');
};

/**
 * Reverse string
 */
export const reverse = (str: string): string => {
  return str.split('').reverse().join('');
};

/**
 * Check if string is palindrome
 */
export const isPalindrome = (str: string): boolean => {
  const cleaned = removeWhitespace(str).toLowerCase();
  return cleaned === reverse(cleaned);
};

/**
 * Count occurrences of substring in string
 */
export const countOccurrences = (str: string, substring: string): number => {
  if (!substring) return 0;
  return (str.match(new RegExp(substring, 'g')) || []).length;
};

/**
 * Replace all occurrences of substring
 */
export const replaceAll = (str: string, search: string, replace: string): string => {
  return str.split(search).join(replace);
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number = 16, chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate random alphanumeric string
 */
export const generateRandomAlphanumeric = (length: number = 16): string => {
  return generateRandomString(length);
};

/**
 * Generate random numeric string
 */
export const generateRandomNumeric = (length: number = 6): string => {
  return generateRandomString(length, '0123456789');
};

/**
 * Pad string to length with character
 */
export const padStart = (str: string, length: number, padStr: string = ' '): string => {
  return str.padStart(length, padStr);
};

/**
 * Pad string at end to length with character
 */
export const padEnd = (str: string, length: number, padStr: string = ' '): string => {
  return str.padEnd(length, padStr);
};

/**
 * Extract numbers from string
 */
export const extractNumbers = (str: string): number[] => {
  return (str.match(/\d+/g) || []).map(Number);
};

/**
 * Extract text between two strings
 */
export const extractBetween = (str: string, start: string, end: string): string => {
  const startIndex = str.indexOf(start);
  const endIndex = str.indexOf(end);
  if (startIndex === -1 || endIndex === -1) return '';
  return str.substring(startIndex + start.length, endIndex);
};

/**
 * Mask sensitive data (e.g., credit card)
 */
export const maskSensitiveData = (str: string, visibleChars: number = 4): string => {
  if (str.length <= visibleChars) return str;
  const masked = '*'.repeat(str.length - visibleChars);
  return masked + str.slice(-visibleChars);
};

/**
 * Check string is empty or only whitespace
 */
export const isEmpty = (str: string): boolean => {
  return !str || str.trim().length === 0;
};

/**
 * Check string is NOT empty and not only whitespace
 */
export const isNotEmpty = (str: string): boolean => {
  return !isEmpty(str);
};

/**
 * Strip HTML tags
 */
export const stripHtmlTags = (str: string): string => {
  return str.replace(/<[^>]*>/g, '');
};

/**
 * Decode HTML entities
 */
export const decodeHtmlEntities = (str: string): string => {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'"
  };

  let decoded = str;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  return decoded;
};

/**
 * Encode string to Base64
 */
export const toBase64 = (str: string): string => {
  return Buffer.from(str).toString('base64');
};

/**
 * Decode Base64 string
 */
export const fromBase64 = (str: string): string => {
  return Buffer.from(str, 'base64').toString('utf-8');
};

/**
 * Check string starts with substring (case-insensitive)
 */
export const startsWithIgnoreCase = (str: string, substr: string): boolean => {
  return str.toLowerCase().startsWith(substr.toLowerCase());
};

/**
 * Check string ends with substring (case-insensitive)
 */
export const endsWithIgnoreCase = (str: string, substr: string): boolean => {
  return str.toLowerCase().endsWith(substr.toLowerCase());
};
