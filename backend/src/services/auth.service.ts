// src/services/auth.service.ts
import bcrypt from "bcryptjs";
import { AppError } from "../middleware/error-handler";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../middleware/jwt-auth";
import * as UserModel from "../models/user.model";
import { logger } from "../utils/logger";
import { ErrorCode } from "../types";
import { verifyGoogleToken } from "../utils/google-auth";
import { isValidEmail, isValidPhone, normalizePhoneNumber, sanitizeEmail } from "../utils/validators";

const serializeUser = (user: UserModel.User, overrides?: { name?: string }): {
  id: number;
  email: string;
  name?: string;
  phoneNumber?: string;
  callConsent: boolean;
  callOptOut: boolean;
  isOnboarded: boolean;
} => {
  const serializedUser: {
    id: number;
    email: string;
    name?: string;
    phoneNumber?: string;
    callConsent: boolean;
    callOptOut: boolean;
    isOnboarded: boolean;
  } = {
    id: user.id,
    email: user.email,
    callConsent: user.call_consent,
    callOptOut: user.call_opt_out,
    isOnboarded: user.is_onboarded,
  };

  const resolvedName = overrides?.name || user.name || undefined;
  if (resolvedName) {
    serializedUser.name = resolvedName;
  }

  if (user.phone_number) {
    serializedUser.phoneNumber = user.phone_number;
  }

  return serializedUser;
};

export const registerUser = async (
  email: string,
  password: string,
  name?: string
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
    const user = await UserModel.createUser(normalizedEmail, passwordHash, "password", undefined, name?.trim() || undefined);
    logger.info("User registered successfully", { userId: user.id, email: normalizedEmail });

    // Generate token pair (access + refresh)
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    return {
      user: serializeUser(user),
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
      user: serializeUser(user),
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
      user = await UserModel.createUser(normalizedEmail, undefined, "google", googleId, name?.trim() || undefined);
      logger.info("New user created via Google OAuth", { userId: user.id, email: normalizedEmail });

      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);

      return {
        user: serializeUser(user, name ? { name } : undefined),
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
        user: serializeUser(user, name ? { name } : undefined),
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
      user = await UserModel.createUser(normalizedEmail, undefined, "google", googleId, name?.trim() || undefined);
      logger.info("New user created via Google OAuth", { userId: user.id, email: normalizedEmail });

      const accessToken = generateAccessToken(user.id, user.email);
      const refreshToken = generateRefreshToken(user.id);

      return {
        user: {
          ...serializeUser(user, name ? { name } : undefined),
          picture: picture || undefined,
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
          ...serializeUser(user, name ? { name } : undefined),
          picture: picture || undefined,
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

export const getCurrentUserProfile = async (userId: string | number): Promise<any> => {
  const user = await UserModel.findUserById(userId);
  if (!user) {
    throw new AppError(404, ErrorCode.USER_NOT_FOUND, "User not found");
  }

  return serializeUser(user);
};

export const updateCurrentUserContactPreferences = async (params: {
  userId: string | number;
  name?: string;
  phoneNumber?: string;
  callConsent?: boolean;
  callOptOut?: boolean;
}): Promise<any> => {
  if (params.phoneNumber && !isValidPhone(params.phoneNumber)) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Phone number must be a valid international number");
  }

  const existingUser = await UserModel.findUserById(params.userId);
  if (!existingUser) {
    throw new AppError(404, ErrorCode.USER_NOT_FOUND, "User not found");
  }

  try {
    const payload: {
      userId: string | number;
      name?: string | null;
      phoneNumber?: string | null;
      callConsent?: boolean;
      callOptOut?: boolean;
    } = {
      userId: params.userId,
    };

    if (params.name !== undefined) {
      payload.name = params.name.trim() || null;
    }

    if (params.phoneNumber !== undefined) {
      payload.phoneNumber = params.phoneNumber.trim() ? normalizePhoneNumber(params.phoneNumber) : null;
    }

    if (params.callConsent !== undefined) {
      payload.callConsent = params.callConsent;
    }

    if (params.callOptOut !== undefined) {
      payload.callOptOut = params.callOptOut;
    }

    const updatedUser = await UserModel.updateUserContactPreferences(payload);

    if (!updatedUser) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, "Failed to update contact preferences");
    }

    return serializeUser(updatedUser);
  } catch (error) {
    const errorCode = (error as { code?: string } | undefined)?.code;
    if (errorCode === "23505") {
      throw new AppError(409, ErrorCode.CONFLICT, "Phone number is already linked to another account");
    }

    if (error instanceof AppError) {
      throw error;
    }

    logger.error("Error updating current user contact preferences", error instanceof Error ? error : new Error(String(error)));
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, "Failed to update contact preferences");
  }
};
