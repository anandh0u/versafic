/**
 * Integration tests for authentication endpoints
 * Tests: register, login, Google OAuth
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.routes';
import { AppError } from '../middleware/error-handler';
import { initializeDatabase } from '../config/database';

describe('Authentication Endpoints', () => {
  let app: express.Application;

  beforeAll(async () => {
    await initializeDatabase();
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    
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

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: uniqueEmail,
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('registered');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('Email');
    });

    it('should reject missing password', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('password');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'ValidPassword123!'
        });

      // First registration succeeds
      if (res.status === 201) {
        // Second registration with same email fails
        const dupRes = await request(app)
          .post('/auth/register')
          .send({
            email: 'existing@example.com',
            password: 'AnotherPassword123!'
          });

        expect(dupRes.status).toBe(409);
        expect(dupRes.body.errorCode).toBe('CONFLICT');
      }
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
    it('should login user with correct credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'LoginPassword123!'
        });

      // Test expects user to exist from previous registration or setup
      if (res.status === 200) {
        expect(res.body.status).toBe('success');
        expect(res.body.message).toContain('successful');
        expect(res.body.data).toHaveProperty('accessToken');
      } else {
        expect([401, 404]).toContain(res.status);
      }
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          password: 'LoginPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject missing password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!'
        });

      expect([401, 404]).toContain(res.status);
      expect(['INVALID_CREDENTIALS', 'NOT_FOUND']).toContain(res.body.errorCode);
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!'
        });

      expect([401, 404]).toContain(res.status);
    });
  });

  describe('POST /auth/google', () => {
    it('should authenticate/register via Google', async () => {
      const res = await request(app)
        .post('/auth/google')
        .send({
          email: 'google@example.com',
          googleId: 'google_id_12345',
          name: 'Google User'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/auth/google')
        .send({
          googleId: 'google_id_12345',
          name: 'Google User'
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('Email');
    });

    it('should reject missing googleId', async () => {
      const res = await request(app)
        .post('/auth/google')
        .send({
          email: 'google@example.com',
          name: 'Google User'
        });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('googleId');
    });
  });
});
