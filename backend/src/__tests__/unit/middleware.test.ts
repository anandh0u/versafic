// src/__tests__/unit/middleware.test.ts - Unit tests for middleware
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/error-handler';

jest.mock('../../utils/security');
jest.mock('../../utils/logger');

describe('Middleware Tests', () => {
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('Error Handler Middleware', () => {
    it('should have error handler defined', () => {
      expect(errorHandler).toBeDefined();
    });
  });


});
