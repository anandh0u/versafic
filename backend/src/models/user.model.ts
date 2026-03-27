// src/models/user.model.ts
import { pool } from "../config/database";
import { logger } from "../utils/logger";

export interface User {
  id: number;
  email: string;
  name?: string | null;
  phone_number?: string | null;
  password_hash?: string;
  provider?: string;
  provider_id?: string;
  is_onboarded: boolean;
  call_consent: boolean;
  call_opt_out: boolean;
  created_at: string;
  updated_at: string;
}

export const findUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const result = await pool.query(
      "SELECT id, email, name, phone_number, password_hash, provider, provider_id, is_onboarded, call_consent, call_opt_out, created_at, updated_at FROM users WHERE email = $1",
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
      "SELECT id, email, name, phone_number, provider, provider_id, is_onboarded, call_consent, call_opt_out, created_at, updated_at FROM users WHERE id = $1",
      [Number(id)]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error finding user by id", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const findUserByPhoneNumber = async (phoneNumber: string): Promise<User | null> => {
  try {
    const normalizedDigits = phoneNumber.replace(/\D/g, '');
    const result = await pool.query(
      `SELECT id, email, name, phone_number, provider, provider_id, is_onboarded, call_consent, call_opt_out, created_at, updated_at
       FROM users
       WHERE regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g') = $1`,
      [normalizedDigits]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error finding user by phone number", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const createUser = async (
  email: string,
  passwordHash?: string,
  provider?: string,
  providerId?: string,
  name?: string,
  phoneNumber?: string | null
): Promise<User> => {
  try {
    const result = await pool.query(
      "INSERT INTO users (email, name, phone_number, password_hash, provider, provider_id, is_onboarded, call_consent, call_opt_out, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, false, false, false, NOW(), NOW()) RETURNING id, email, name, phone_number, provider, is_onboarded, call_consent, call_opt_out, created_at, updated_at",
      [email, name || null, phoneNumber || null, passwordHash || null, provider || 'password', providerId || null]
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
      "UPDATE users SET is_onboarded = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, phone_number, is_onboarded, call_consent, call_opt_out, created_at, updated_at",
      [isOnboarded, Number(id)]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error updating onboarding status", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const updateUserContactPreferences = async (params: {
  userId: string | number;
  name?: string | null;
  phoneNumber?: string | null;
  callConsent?: boolean;
  callOptOut?: boolean;
}): Promise<User | null> => {
  try {
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($2, name),
           phone_number = COALESCE($3, phone_number),
           call_consent = COALESCE($4, call_consent),
           call_opt_out = COALESCE($5, call_opt_out),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, phone_number, provider, provider_id, is_onboarded, call_consent, call_opt_out, created_at, updated_at`,
      [
        Number(params.userId),
        params.name ?? null,
        params.phoneNumber ?? null,
        params.callConsent ?? null,
        params.callOptOut ?? null,
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error updating user contact preferences", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const setUserCallOptOut = async (
  userId: string | number,
  optedOut: boolean
): Promise<User | null> => {
  try {
    const result = await pool.query(
      `UPDATE users
       SET call_opt_out = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, phone_number, provider, provider_id, is_onboarded, call_consent, call_opt_out, created_at, updated_at`,
      [Number(userId), optedOut]
    );

    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error updating call opt-out status", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};
