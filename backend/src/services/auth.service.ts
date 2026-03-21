// src/services/auth.service.ts
import bcrypt from "bcryptjs";
import { AppError } from "../middleware/error-handler";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../middleware/jwt-auth";
import * as UserModel from "../models/user.model";
import { logger } from "../utils/logger";
import { ErrorCode } from "../types";
import { verifyGoogleToken } from "../utils/google-auth";
import { isValidEmail, sanitizeEmail } from "../utils/validators";

export const registerUser = async (
  email: string,
  password: string
): Promise<{ user: any; accessToken: string; refreshToken: string }> => {
  try {
    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      logger.warn("User registration attempted with invalid email", { email });
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email format");
    }

    // Check if user exists
    const existingUser = await UserModel.findUserByEmail(normalizedEmail);
    if (existingUser) {
      logger.warn("User registration attempted with existing email", { email: normalizedEmail });
      throw new AppError(409, ErrorCode.CONFLICT, "User with this email already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await UserModel.createUser(normalizedEmail, passwordHash);
    logger.info("User registered successfully", { userId: user.id, email: normalizedEmail });

    // Generate token pair (access + refresh)
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        isOnboarded: user.is_onboarded
      },
      accessToken,
      refreshToken
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error during user registration", error instanceof Error ? error : new Error(String(error)));
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, "Failed to register user");
  }
};

export const loginUser = async (
  email: string,
  password: string
): Promise<{ user: any; accessToken: string; refreshToken: string }> => {
  try {
    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      logger.warn("Login attempt with invalid email", { email });
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email format");
    }

    // Find user
    const user = await UserModel.findUserByEmail(normalizedEmail);
    if (!user) {
      logger.warn("Login attempt with non-existent email", { email: normalizedEmail });
      throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
    }

    // Verify password
    if (!user.password_hash) {
      logger.warn("Login attempt for OAuth user with email/password", { email: normalizedEmail });
      throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, "This account uses OAuth login");
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      logger.warn("Login attempt with wrong password", { email: normalizedEmail });
      throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
    }

    logger.info("User logged in successfully", { userId: user.id, email: normalizedEmail });

    // Generate token pair (access + refresh)
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        isOnboarded: user.is_onboarded
      },
      accessToken,
      refreshToken
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error during login", error instanceof Error ? error : new Error(String(error)));
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, "Failed to login");
  }
};

export const handleGoogleAuth = async (
  email: string,
  googleId: string,
  name?: string
): Promise<{ user: any; accessToken: string; refreshToken: string; isNewUser: boolean }> => {
  try {
    const normalizedEmail = sanitizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      logger.warn("Google auth attempted with invalid email", { email });
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid email format");
    }

    let user = await UserModel.findUserByEmail(normalizedEmail);

    if (!user) {
      // Create new user with Google OAuth
      user = await UserModel.createUser(normalizedEmail, undefined, "google", googleId);
      logger.info("New user created via Google OAuth", { userId: user.id, email: normalizedEmail });

      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          isOnboarded: user.is_onboarded
        },
        accessToken,
        refreshToken,
        isNewUser: true
      };
    } else {
      // Existing user - login
      logger.info("User logged in via Google OAuth", { userId: user.id, email: normalizedEmail });

      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);
      return {
        user: {
          id: user.id,
          email: user.email,
          isOnboarded: user.is_onboarded
        },
        accessToken,
        refreshToken,
        isNewUser: false
      };
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error during Google authentication", error instanceof Error ? error : new Error(String(error)));
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, "Failed to authenticate with Google");
  }
};

/**
 * Handle Google ID token verification and authentication
 * This function verifies the Google ID token and authenticates the user
 */
export const handleGoogleIdTokenAuth = async (
  idToken: string
): Promise<{ user: any; accessToken: string; refreshToken: string; isNewUser: boolean }> => {
  try {
    logger.info("Google authentication request received");

    // Verify Google ID token
    logger.debug("Verifying Google ID token");
    const tokenData = await verifyGoogleToken(idToken);
    logger.info("Google ID token verified successfully", {
      email: tokenData.email,
      googleId: tokenData.googleId
    });

    const normalizedEmail = sanitizeEmail(tokenData.email);
    const { googleId, name, picture } = tokenData;

    // Check if user exists
    let user = await UserModel.findUserByEmail(normalizedEmail);

    if (!user) {
      // Create new user with Google OAuth
      logger.info("Creating new user from Google authentication", { email: normalizedEmail, googleId });
      user = await UserModel.createUser(normalizedEmail, undefined, "google", googleId);
      logger.info("New user created via Google OAuth", { userId: user.id, email: normalizedEmail });

      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: name || user.email,
          picture: picture || undefined,
          isOnboarded: user.is_onboarded
        },
        accessToken,
        refreshToken,
        isNewUser: true
      };
    } else {
      // Existing user - login
      logger.info("User logged in via Google OAuth", { userId: user.id, email: normalizedEmail });

      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: name || user.email,
          picture: picture || undefined,
          isOnboarded: user.is_onboarded
        },
        accessToken,
        refreshToken,
        isNewUser: false
      };
    }
  } catch (error) {
    if (error instanceof AppError) throw error;

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error during Google ID token authentication", new Error(errorMessage));

    // Provide specific error messages
    if (errorMessage.includes("Invalid Google")) {
      throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, "Invalid Google ID token");
    }

    throw new AppError(500, ErrorCode.INTERNAL_ERROR, "Failed to authenticate with Google");
  }
};

export const refreshAuthToken = async (
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> => {
  try {
    const decoded = verifyRefreshToken(refreshToken) as any;

    if (!decoded || decoded.type !== "refresh" || !decoded.id) {
      throw new Error("Invalid refresh token");
    }

    const user = await UserModel.findUserById(decoded.id);
    if (!user) {
      throw new AppError(401, ErrorCode.INVALID_TOKEN, "User not found");
    }

    const accessToken = generateAccessToken(user.id, user.email);
    const newRefreshToken = generateRefreshToken(user.id);

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, ErrorCode.INVALID_TOKEN, "Invalid refresh token");
  }
};
