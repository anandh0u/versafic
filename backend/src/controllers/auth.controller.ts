// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import * as AuthService from "../services/auth.service";
import { AppError } from "../middleware/error-handler";
import { ErrorCode } from "../types";
import { isStrongPassword, isValidEmail, sanitizeEmail } from "../utils/validators";

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Email and password are required"));
    }

    // Validate and sanitize email
    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email format"));
    }

    // Validate password strength
    const passwordValidation = isStrongPassword(password);
    if (!passwordValidation.valid) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR,
        `Password requirements: ${passwordValidation.errors.join(", ")}`));
    }

    const result = await AuthService.registerUser(normalizedEmail, password);

    res.status(201).json({
      status: "success",
      message: "User registered successfully",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Email and password are required"));
    }

    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email format"));
    }

    const result = await AuthService.loginUser(normalizedEmail, password);

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== "string") {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Refresh token is required"));
    }

    const result = await AuthService.refreshAuthToken(refreshToken);

    res.status(200).json({
      status: "success",
      message: "Token refreshed successfully",
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, googleId, name } = req.body;

    if (typeof email !== "string" || typeof googleId !== "string" || !email || !googleId) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Email and googleId are required"));
    }

    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email format"));
    }

    const result = await AuthService.handleGoogleAuth(normalizedEmail, googleId, name);

    res.status(result.isNewUser ? 201 : 200).json({
      status: "success",
      message: result.isNewUser ? "Account created via Google" : "Login successful via Google",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Google ID token verification endpoint
 * Accepts Google ID token from frontend and verifies it
 */
export const googleAuthWithIdToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Google ID token (idToken) is required"));
    }

    const result = await AuthService.handleGoogleIdTokenAuth(idToken);

    res.status(result.isNewUser ? 201 : 200).json({
      status: "success",
      message: result.isNewUser ? "Account created via Google" : "Login successful via Google",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};
