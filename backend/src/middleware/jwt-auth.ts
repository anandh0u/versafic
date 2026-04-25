// src/middleware/jwt-auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./error-handler";
import { getEnv } from "../utils/env";
import { logger } from "../utils/logger";
import { ErrorCode } from "../types";

export interface AuthRequest extends Request {
  user?: {
    id: string | number;
    email: string;
  };
}

interface JWTPayload {
  id: string | number;
  email: string;
  iat?: number;
  exp?: number;
}

interface RefreshTokenPayload {
  id: string | number;
  type: "refresh";
  iat?: number;
  exp?: number;
}

// Type guard for JWT payload
const isValidJWTPayload = (payload: unknown): payload is JWTPayload => {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.id !== 'undefined' && typeof p.email === 'string';
};

// Type guard for refresh token payload
const isValidRefreshTokenPayload = (payload: unknown): payload is RefreshTokenPayload => {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return typeof p.id !== 'undefined' && p.type === 'refresh';
};

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new AppError(401, ErrorCode.MISSING_TOKEN, "Authorization token is required"));
    }

    const decoded = verifyAccessToken(token);
    
    if (!isValidJWTPayload(decoded)) {
      logger.warn("Invalid JWT payload structure", { decoded });
      return next(new AppError(401, ErrorCode.INVALID_TOKEN, "Invalid token structure"));
    }

    req.user = { id: decoded.id, email: decoded.email };
    logger.debug("Token verified", { userId: decoded.id });
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn("Invalid token", { error: error.message });
      return next(new AppError(401, ErrorCode.INVALID_TOKEN, "Invalid or expired token"));
    }
    if (error instanceof AppError) {
      return next(error);
    }
    logger.error("Token verification error", error instanceof Error ? error : new Error(String(error)));
    return next(new AppError(401, ErrorCode.AUTH_ERROR, "Authentication failed"));
  }
};

export const generateAccessToken = (id: string | number, email: string): string => {
  return jwt.sign({ id, email }, getEnv("JWT_SECRET"), {
    expiresIn: "15m"
  });
};

export const generateRefreshToken = (id: string | number): string => {
  return jwt.sign({ id, type: "refresh" }, getEnv("JWT_REFRESH_SECRET"), {
    expiresIn: "7d"
  });
};

export const verifyAccessToken = (token: string): JWTPayload => {
  const decoded = jwt.verify(token, getEnv("JWT_SECRET")) as unknown;
  
  if (!isValidJWTPayload(decoded)) {
    throw new Error("Invalid JWT payload structure");
  }
  
  return decoded;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, getEnv("JWT_REFRESH_SECRET")) as unknown;
  
  if (!isValidRefreshTokenPayload(decoded)) {
    throw new Error("Invalid refresh token payload structure");
  }
  
  return decoded;
};

export const generateToken = (id: string, email: string): string => {
  // Legacy helper (kept for backward compatibility)
  return generateAccessToken(id, email);
};
