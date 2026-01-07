import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { testPrisma, testUtils, mockS3, mockOpenAI, mockStripe } from '../../__tests__/setup';
import { prisma } from '../../lib/prisma';
import { env } from '../../env';

// Mock the prisma client
jest.mock('../../lib/prisma', () => ({
  prisma: testPrisma,
}));

// Import routes after mocking
import authRoutes from '../../routes/auth';

const app = express();
app.use(express.json());
app.use(authRoutes);

describe('Authentication Routes', () => {
  beforeEach(async () => {
    await testUtils.cleanup();
  });

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        name: 'New User',
        password: 'password123',
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        user: {
          id: expect.any(String),
          email: userData.email,
          name: userData.name,
        },
        accessToken: expect.any(String),
      });

      // Verify user was created in database
      const user = await testPrisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(user).toBeTruthy();
      expect(user?.email).toBe(userData.email);
      expect(user?.name).toBe(userData.name);

      // Verify password is hashed
      expect(user?.passwordHash).not.toBe(userData.password);
      expect(await bcrypt.compare(userData.password, user?.passwordHash || '')).toBe(true);

      // Verify refresh token was created
      const refreshToken = await testPrisma.refreshToken.findFirst({
        where: { userId: user?.id },
      });
      expect(refreshToken).toBeTruthy();
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        name: 'Test User',
        password: 'password123',
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: '123',
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('password');
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        name: 'Existing User',
        password: 'password123',
      };

      // Create first user
      await testUtils.createTestUser({ email: userData.email });

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /login', () => {
    beforeEach(async () => {
      // Create a test user
      await testUtils.createTestUser({
        email: 'login@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'password123',
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          id: expect.any(String),
          email: loginData.email,
        },
        accessToken: expect.any(String),
      });

      // Verify refresh token was created
      const refreshToken = await testPrisma.refreshToken.findFirst({
        where: { userId: response.body.user.id },
      });
      expect(refreshToken).toBeTruthy();

      // Verify refresh token cookie was set
      expect(response.headers['set-cookie']).toBeDefined();
      const cookieHeader = response.headers['set-cookie'][0];
      expect(cookieHeader).toContain('refreshToken=');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('Secure');
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword',
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });
  });

  describe('POST /refresh', () => {
    let user: any;
    let refreshToken: any;

    beforeEach(async () => {
      user = await testUtils.createTestUser({
        email: 'refresh@example.com',
      });

      refreshToken = await testPrisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: await bcrypt.hash('refresh-token', 10),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/refresh')
        .set('Cookie', `refreshToken=refresh-token`)
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
      });

      // Verify new refresh token was created
      const newRefreshToken = await testPrisma.refreshToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(newRefreshToken).toBeTruthy();
      expect(newRefreshToken?.id).not.toBe(refreshToken.id);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/refresh')
        .set('Cookie', `refreshToken=invalid-token`)
        .expect(401);

      expect(response.body.error).toContain('Invalid refresh token');
    });

    it('should reject refresh with expired token', async () => {
      // Update token to be expired
      await testPrisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: {
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        },
      });

      const response = await request(app)
        .post('/refresh')
        .set('Cookie', `refreshToken=refresh-token`)
        .expect(401);

      expect(response.body.error).toContain('Invalid refresh token');
    });
  });

  describe('POST /logout', () => {
    let user: any;
    let refreshToken: any;

    beforeEach(async () => {
      user = await testUtils.createTestUser({
        email: 'logout@example.com',
      });

      refreshToken = await testPrisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: await bcrypt.hash('logout-token', 10),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/logout')
        .set('Cookie', `refreshToken=logout-token`)
        .expect(200);

      expect(response.body.message).toContain('Logged out successfully');

      // Verify refresh token was deleted
      const deletedToken = await testPrisma.refreshToken.findUnique({
        where: { id: refreshToken.id },
      });
      expect(deletedToken).toBeNull();

      // Verify cookie was cleared
      const cookieHeader = response.headers['set-cookie'][0];
      expect(cookieHeader).toContain('refreshToken=');
      expect(cookieHeader).toContain('Max-Age=0');
    });

    it('should handle logout without refresh token', async () => {
      const response = await request(app)
        .post('/logout')
        .expect(200);

      expect(response.body.message).toContain('Logged out successfully');
    });
  });

  describe('GET /me', () => {
    let user: any;
    let accessToken: string;

    beforeEach(async () => {
      user = await testUtils.createTestUser({
        email: 'me@example.com',
      });

      accessToken = testUtils.generateTestToken({
        userId: user.id,
        email: user.email,
      });
    });

    it('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/me')
        .expect(401);

      expect(response.body.error).toContain('No token provided');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toContain('Invalid token');
    });

    it('should reject request with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: user.id, email: user.email },
        env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toContain('Token expired');
    });
  });

  describe('Password Security', () => {
    it('should hash passwords with proper salt rounds', async () => {
      const userData = {
        email: 'security@example.com',
        name: 'Security Test',
        password: 'password123',
      };

      await request(app)
        .post('/register')
        .send(userData)
        .expect(201);

      const user = await testPrisma.user.findUnique({
        where: { email: userData.email },
      });

      expect(user?.passwordHash).toBeTruthy();
      expect(user?.passwordHash).not.toBe(userData.password);
      expect(user?.passwordHash).toMatch(/^\$2b\$10\$/); // bcrypt format
    });

    it('should not expose password hash in responses', async () => {
      const userData = {
        email: 'nopassword@example.com',
        name: 'No Password',
        password: 'password123',
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.passwordHash).toBeUndefined();
      expect(response.body.user.password).toBeUndefined();
    });
  });

  describe('Token Rotation', () => {
    it('should rotate refresh tokens on refresh', async () => {
      const user = await testUtils.createTestUser({
        email: 'rotation@example.com',
      });

      const originalRefreshToken = await testPrisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: await bcrypt.hash('original-token', 10),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .post('/refresh')
        .set('Cookie', `refreshToken=original-token`)
        .expect(200);

      // Verify old token was invalidated
      const oldToken = await testPrisma.refreshToken.findUnique({
        where: { id: originalRefreshToken.id },
      });
      expect(oldToken).toBeNull();

      // Verify new token was created
      const newToken = await testPrisma.refreshToken.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(newToken).toBeTruthy();
      expect(newToken?.id).not.toBe(originalRefreshToken.id);
    });
  });
});
