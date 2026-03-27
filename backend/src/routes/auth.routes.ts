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
 * @route POST /auth/refresh
 * @description Refresh access token using refresh token
 * @body refreshToken
 */
router.post("/refresh", AuthController.refreshToken);

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
