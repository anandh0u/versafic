// src/models/user.model.ts
import { pool } from "../config/database";
import { logger } from "../utils/logger";

export interface User {
  id: number;
  email: string;
  password_hash?: string;
  provider?: string;
  provider_id?: string;
  is_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export const findUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, provider, provider_id, is_onboarded, created_at, updated_at FROM users WHERE email = $1",
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error finding user by email", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const findUserById = async (id: string | number): Promise<User | null> => {
  try {
    const result = await pool.query(
      "SELECT id, email, provider, provider_id, is_onboarded, created_at, updated_at FROM users WHERE id = $1",
      [Number(id)]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error finding user by id", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const createUser = async (
  email: string,
  passwordHash?: string,
  provider?: string,
  providerId?: string
): Promise<User> => {
  try {
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, provider, provider_id, is_onboarded, created_at, updated_at) VALUES ($1, $2, $3, $4, false, NOW(), NOW()) RETURNING id, email, provider, is_onboarded, created_at, updated_at",
      [email, passwordHash || null, provider || 'password', providerId || null]
    );
    const user = result.rows[0];
    logger.info("User created in database", {
      userId: user.id,
      email: user.email,
      provider: user.provider,
      database: process.env.DB_HOST
    });
    return user;
  } catch (error) {
    logger.error("Error creating user in database", error instanceof Error ? error : new Error(String(error)), {
      email,
      provider: provider || 'password',
      database: process.env.DB_HOST
    });
    throw error;
  }
};

export const updateUserOnboardingStatus = async (
  id: string | number,
  isOnboarded: boolean
): Promise<User | null> => {
  try {
    const result = await pool.query(
      "UPDATE users SET is_onboarded = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_onboarded, created_at, updated_at",
      [isOnboarded, Number(id)]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error updating onboarding status", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};
