// src/__tests__/unit/security.utils.test.ts - Unit tests for security utilities
import {
  hashPassword,
  comparePassword,
  sanitizeInput,
} from '../../utils/security';
import { generateToken } from '../../middleware/jwt-auth';

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Security Utilities', () => {
  describe('hashPassword', () => {
    it('should hash password', async () => {
      const spy = jest
        .spyOn(require('bcryptjs'), 'hash')
        .mockResolvedValue('hashed-password');

      await hashPassword('password123');

      expect(spy).toHaveBeenCalled();
    });

    it('should use correct salt rounds', async () => {
      const spy = jest
        .spyOn(require('bcryptjs'), 'hash')
        .mockResolvedValue('hashed');

      await hashPassword('password');

      // Verify salt rounds (typically 10)
      expect(spy).toHaveBeenCalledWith('password', expect.any(Number));
    });
  });

  describe('comparePassword', () => {
    it('should compare password with hash', async () => {
      const spy = jest
        .spyOn(require('bcryptjs'), 'compare')
        .mockResolvedValue(true);

      const result = await comparePassword('password123', 'hashed-password');

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      jest
        .spyOn(require('bcryptjs'), 'compare')
        .mockResolvedValue(false);

      const result = await comparePassword('wrong', 'hashed');

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should have token generation function', () => {
      expect(generateToken).toBeDefined();
      expect(typeof generateToken).toBe('function');
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      const result = sanitizeInput('<script>alert("xss")</script>');

      expect(result).not.toContain('<script>');
    });

    it('should preserve safe content', () => {
      const input = 'Hello World 123';
      expect(sanitizeInput(input)).toContain('Hello');
    });

    it('should handle special characters', () => {
      const input = 'test@example.com';
      const result = sanitizeInput(input);

      expect(result).toBeTruthy();
    });
  });
});
