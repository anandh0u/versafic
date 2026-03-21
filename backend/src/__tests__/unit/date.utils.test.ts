// src/__tests__/unit/date.utils.test.ts - Unit tests for date utilities
import {
  formatDate,
  parseDate,
  addHours,
} from '../../utils/date';

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('should format date to string', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle date to string conversion', () => {
      const date = new Date('2024-01-15T10:30:00');
      const result = formatDate(date);
      expect(typeof result).toBe('string');
    });
  });

  describe('parseDate', () => {
    it('should parse date string', () => {
      const result = parseDate('2024-01-15');
      expect(result).toBeInstanceOf(Date);
    });

    it('should return null for invalid date', () => {
      expect(parseDate('invalid')).toBeNull();
    });
  });

  describe('Date operations', () => {
    it('should have date utilities available', () => {
      expect(formatDate).toBeDefined();
      expect(addHours).toBeDefined();
    });
  });

  describe('addHours', () => {
    it('should add hours to date', () => {
      const date = new Date('2024-01-15T10:00:00');
      const result = addHours(date, 2);
      expect(result.getHours()).toBe(12);
    });

    it('should handle day boundary', () => {
      const date = new Date('2024-01-15T23:00:00');
      const result = addHours(date, 2);
      expect(result.getDate()).toBe(16);
    });
  });


});
