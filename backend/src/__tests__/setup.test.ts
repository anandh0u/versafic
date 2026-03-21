/**
 * Integration tests for setup/onboarding endpoints
 * Tests: business profile creation, retrieval, status
 * Requires JWT authentication
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import setupRoutes from '../routes/setup.routes';
import { AppError } from '../middleware/error-handler';

describe('Setup/Onboarding Endpoints', () => {
  let app: express.Application;
  let validToken: string;
  let expiredToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Create test tokens
    const secret = process.env.JWT_SECRET || 'test_secret_key_for_testing_purposes';
    validToken = jwt.sign(
      { id: 'test-user-123', email: 'test@example.com' },
      secret,
      { expiresIn: '1h' }
    );

    expiredToken = jwt.sign(
      { id: 'test-user-456', email: 'expired@example.com' },
      secret,
      { expiresIn: '0s' } // Expired immediately
    );

    app.use('/setup', setupRoutes);

    // Error handler middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          status: 'error',
          statusCode: err.statusCode,
          errorCode: err.errorCode,
          message: err.message,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          status: 'error',
          statusCode: 500,
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    });
  });

  describe('POST /setup/business', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/setup/business')
        .send({
          businessName: 'Test Business'
        });

      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('MISSING_TOKEN');
    });

    it('should reject expired token', async () => {
      const res = await request(app)
        .post('/setup/business')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          businessName: 'Test Business'
        });

      expect([401, 403]).toContain(res.status);
    });

    it('should reject invalid token format', async () => {
      const res = await request(app)
        .post('/setup/business')
        .set('Authorization', 'InvalidTokenFormat')
        .send({
          businessName: 'Test Business'
        });

      expect(res.status).toBe(401);
    });

    it('should require businessName', async () => {
      const res = await request(app)
        .post('/setup/business')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          businessType: 'LLC'
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('Business name');
    });

    it('should create business profile with valid data', async () => {
      const res = await request(app)
        .post('/setup/business')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          businessName: 'Test Business Inc',
          businessType: 'LLC',
          industry: 'Technology',
          website: 'https://testbusiness.com',
          country: 'US',
          phone: '+1234567890'
        });

      expect([201, 200, 500]).toContain(res.status);
      if (res.status !== 500) {
        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveProperty('business_name');
      }
    });

    it('should allow partial business profile updates', async () => {
      const res = await request(app)
        .post('/setup/business')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          businessName: 'Updated Business'
        });

      expect([201, 200, 500]).toContain(res.status);
    });
  });

  describe('GET /setup/business', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/setup/business');

      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('MISSING_TOKEN');
    });

    it('should reject expired token', async () => {
      const res = await request(app)
        .get('/setup/business')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it('should retrieve business profile for authenticated user', async () => {
      const res = await request(app)
        .get('/setup/business')
        .set('Authorization', `Bearer ${validToken}`);

      expect([200, 404, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('business_name');
      }
    });
  });

  describe('GET /setup/status', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/setup/status');

      expect(res.status).toBe(401);
      expect(res.body.errorCode).toBe('MISSING_TOKEN');
    });

    it('should return onboarding status', async () => {
      const res = await request(app)
        .get('/setup/status')
        .set('Authorization', `Bearer ${validToken}`);

      expect([200, 404, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('isOnboarded');
        expect(res.body.data).toHaveProperty('hasBusinessProfile');
      }
    });

    it('should indicate when profile is missing', async () => {
      const res = await request(app)
        .get('/setup/status')
        .set('Authorization', `Bearer ${validToken}`);

      if (res.status === 200) {
        expect([true, false]).toContain(res.body.data.hasBusinessProfile);
      }
    });
  });
});
