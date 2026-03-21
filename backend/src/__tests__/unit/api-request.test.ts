// src/__tests__/unit/api-request.test.ts - Unit tests for API request utility
import { buildQueryParams } from '../../utils/api-request';

jest.mock('axios');

describe('API Request Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildQueryParams', () => {
    it('should build query parameters', () => {
      const params = { name: 'test', page: 1 };
      const result = buildQueryParams(params);
      expect(result).toContain('name=test');
      expect(result).toContain('page=1');
    });

    it('should filter undefined values', () => {
      const params = { name: 'test', value: undefined };
      const result = buildQueryParams(params);
      expect(result).toContain('name=test');
      expect(result).not.toContain('undefined');
    });
  });
});
