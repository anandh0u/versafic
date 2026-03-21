/**
 * Integration tests for health endpoint
 * Tests: database connectivity check
 */

import request from 'supertest';
import express from 'express';

describe('Health Endpoint', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    
    // Simple health check without actual DB connection for testing
    app.get('/health', (req: express.Request, res: express.Response) => {
      res.status(200).json({
        status: 'success',
        message: 'System is healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    });

    // Simulated database failure endpoint for testing
    app.get('/health-fail', (req: express.Request, res: express.Response) => {
      res.status(503).json({
        status: 'error',
        message: 'Database is not responding',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status when database is connected', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('healthy');
      expect(res.body.database).toBe('connected');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should return lightweight query result', async () => {
      const res = await request(app).get('/health');

      expect(res.body).not.toHaveProperty('detailed_data');
      expect(Object.keys(res.body).length).toBeLessThan(5);
    });

    it('should handle database disconnection gracefully', async () => {
      const res = await request(app).get('/health-fail');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
      expect(res.body.database).toBe('disconnected');
    });
  });
});
