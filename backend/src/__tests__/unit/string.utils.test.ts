// src/__tests__/unit/string.utils.test.ts - Unit tests for string utilities
import {
  capitalize,
  truncate,
  toCamelCase,
} from '../../utils/string';

describe('String Utilities', () => {
  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    it('should return empty string as is', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle already capitalized strings', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });
  });



  describe('truncate', () => {
    it('should truncate long strings', () => {
      const result = truncate('This is a very long string', 10);
      expect(result.length).toBeLessThanOrEqual(13); // 10 + "..."
    });

    it('should not truncate short strings', () => {
      expect(truncate('Short', 10)).toBe('Short');
    });
  });

  describe('toCamelCase', () => {
    it('should convert to camelCase', () => {
      expect(toCamelCase('hello world')).toBe('helloWorld');
      expect(toCamelCase('test string case')).toBe('testStringCase');
    });
  });


});
