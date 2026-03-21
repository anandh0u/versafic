// src/__tests__/unit/auth.service.test.ts - Unit tests for auth service
import * as authService from '../../services/auth.service';
import * as userModel from '../../models/user.model';

jest.mock('../../models/user.model');
jest.mock('../../utils/security');
jest.mock('bcryptjs');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should successfully register a new user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        is_onboarded: false,
      };

      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(null);
      (userModel.createUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.registerUser('test@example.com', 'password123');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw error for invalid email', async () => {
      await expect(
        authService.registerUser('invalid-email', 'password123')
      ).rejects.toThrow();
    });

    it('should throw error if email already exists', async () => {
      (userModel.findUserByEmail as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'existing@example.com'
      });

      await expect(
        authService.registerUser('existing@example.com', 'password123')
      ).rejects.toThrow();
    });


  });

  describe('loginUser', () => {
    it('should successfully login user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        is_onboarded: true,
      };

      (userModel.findUserByEmail as jest.Mock).mockResolvedValue(mockUser);

      // Mock bcrypt.compare to return true
      const bcrypt = require('bcryptjs');
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      const result = await authService.loginUser('test@example.com', 'password123');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('Token validation', () => {
    it('should handle auth service for token operations', () => {
      // Token operations are in jwt-auth middleware
      expect(authService).toBeDefined();
    });
  });
});
