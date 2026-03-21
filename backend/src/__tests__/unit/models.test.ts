// src/__tests__/unit/models.test.ts - Unit tests for database models
import * as userModel from '../../models/user.model';
import * as chatModel from '../../models/chat.model';
import * as businessModel from '../../models/onboarding.model';

jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('Database Models', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Model', () => {
    it('should have user model available', () => {
      expect(userModel).toBeDefined();
    });

    it('should have createUser method', () => {
      expect(typeof userModel.createUser).toBe('function');
    });
  });


});
