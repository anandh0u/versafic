// src/__tests__/unit/validators.test.ts - Unit tests for validation utilities
import {
  isValidEmail,
  isValidBusinessName,
} from '../../utils/validators';

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });

    it('should reject empty email', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('String validators', () => {
    it('should have validation utilities', () => {
      expect(isValidEmail).toBeDefined();
      expect(isValidBusinessName).toBeDefined();
    });
  });




});
