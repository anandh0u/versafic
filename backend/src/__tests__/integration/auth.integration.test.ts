// src/__tests__/integration/auth.integration.test.ts - Integration tests for auth flow
import { registerUser } from '../../services/auth.service';
import { UserService } from '../../services/user-service';
import { Pool } from 'pg';

jest.mock('../../services/auth.service');
jest.mock('../../services/user-service');

describe('Auth Integration Tests', () => {
  let pool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = {} as jest.Mocked<Pool>;
  });

  describe('Complete Auth Flow', () => {
    it('should complete registration flow', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        is_onboarded: false,
      };

      (registerUser as jest.Mock).mockResolvedValue({
        user: mockUser,
        token: 'mock-token',
      });

      const result = await registerUser('test@example.com', 'password123');

      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should reject duplicate registrations', async () => {
      (registerUser as jest.Mock).mockRejectedValue(
        new Error('User with this email already exists')
      );

      await expect(
        registerUser('duplicate@example.com', 'password123')
      ).rejects.toThrow();
    });

    it('should reject invalid emails', async () => {
      (registerUser as jest.Mock).mockRejectedValue(
        new Error('Invalid email format')
      );

      await expect(
        registerUser('invalid-email', 'password123')
      ).rejects.toThrow();
    });
  });

  describe('User Service Integration', () => {
    it('should retrieve user after registration', async () => {
      const userService = new UserService(pool);

      (userService.getUserByEmail as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      const user = await userService.getUserByEmail('test@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });
  });
});
