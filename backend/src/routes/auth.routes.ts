// src/routes/auth.routes.ts
import { Router } from "express";
import * as AuthController from "../controllers/auth.controller";
import { verifyToken } from "../middleware/jwt-auth";

const router = Router();

/**
 * @route POST /auth/register
 * @description Register new user with email and password
 * @body email, password
 */
router.post("/register", AuthController.register);

/**
 * @route POST /auth/login
 * @description Login user with email and password
 * @body email, password
 */
router.post("/login", AuthController.login);

/**
 * @route POST /auth/validate-email
 * @description Validate whether an email can be used for registration
 * @body email
 */
router.post("/validate-email", AuthController.validateEmail);

/**
 * @route POST /auth/forgot-password
 * @description Send a short-lived password reset link
 * @body email
 */
router.post("/forgot-password", AuthController.forgotPassword);

/**
 * @route POST /auth/reset-password
 * @description Reset password using a short-lived token
 * @body token, password
 */
router.post("/reset-password", AuthController.resetPassword);

/**
 * @route POST /auth/refresh
 * @description Refresh access token using refresh token
 * @body refreshToken
 */
router.post("/refresh", AuthController.refreshToken);

/**
 * @route GET /auth/google/start
 * @description Start Google OAuth consent flow
 */
router.get("/google/start", AuthController.startGoogleOAuth);

/**
 * @route GET /auth/google/callback
 * @description Google OAuth callback
 */
router.get("/google/callback", AuthController.googleOAuthCallback);

/**
 * @route POST /auth/google
 * @description Authenticate/register user via Google OAuth (manual data)
 * @body email, googleId, name (optional)
 */
router.post("/google", AuthController.googleAuth);

/**
 * @route POST /auth/google/idtoken
 * @description Authenticate/register user via Google ID token verification
 * @body idToken (Google ID token from frontend)
 */
router.post("/google/idtoken", AuthController.googleAuthWithIdToken);

/**
 * @route GET /auth/github/start
 * @description Start GitHub OAuth consent flow
 */
router.get("/github/start", AuthController.startGitHubOAuth);

/**
 * @route GET /auth/github/callback
 * @description GitHub OAuth callback
 */
router.get("/github/callback", AuthController.githubOAuthCallback);

/**
 * @route GET /auth/me
 * @description Retrieve the authenticated user profile and call preferences
 */
router.get("/me", verifyToken, AuthController.getCurrentUser);

/**
 * @route PATCH /auth/me
 * @description Update authenticated user contact and call preference settings
 */
router.patch("/me", verifyToken, AuthController.updateCurrentUserPreferences);

export default router;
