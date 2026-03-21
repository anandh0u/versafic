// src/__tests__/setup.ts - Jest test setup
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/versafic_test';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock getEnv to prevent process.exit in tests
jest.mock('../utils/env', () => ({
  getEnv: (key: string) => {
    const envVars: Record<string, string> = {
      JWT_SECRET: 'test-secret-key',
      JWT_REFRESH_SECRET: 'test-refresh-secret-key',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    };
    return envVars[key] || `mock-${key}`;
  },
}));

// Global test timeout
jest.setTimeout(10000);
