// src/models/onboarding.model.ts
import { pool } from "../config/database";
import { logger } from "../utils/logger";

export interface BusinessProfile {
  id: string;
  user_id: number;
  business_name: string;
  business_type?: string;
  industry?: string;
  website?: string;
  country?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export const findBusinessByUserId = async (userId: string | number): Promise<BusinessProfile | null> => {
  try {
    const result = await pool.query(
      "SELECT id, user_id, business_name, business_type, industry, website, country, phone, created_at, updated_at FROM business_profiles WHERE user_id = $1",
      [Number(userId)]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error finding business profile", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const createBusinessProfile = async (
  userId: string | number,
  businessName: string,
  businessType?: string,
  industry?: string,
  website?: string,
  country?: string,
  phone?: string
): Promise<BusinessProfile> => {
  try {
    const result = await pool.query(
      "INSERT INTO business_profiles (user_id, business_name, business_type, industry, website, country, phone, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id, user_id, business_name, business_type, industry, website, country, phone, created_at, updated_at",
      [Number(userId), businessName, businessType || null, industry || null, website || null, country || null, phone || null]
    );
    return result.rows[0];
  } catch (error) {
    logger.error("Error creating business profile", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};

export const updateBusinessProfile = async (
  userId: string | number,
  businessName: string,
  businessType?: string,
  industry?: string,
  website?: string,
  country?: string,
  phone?: string
): Promise<BusinessProfile | null> => {
  try {
    const result = await pool.query(
      "UPDATE business_profiles SET business_name = $1, business_type = $2, industry = $3, website = $4, country = $5, phone = $6, updated_at = NOW() WHERE user_id = $7 RETURNING id, user_id, business_name, business_type, industry, website, country, phone, created_at, updated_at",
      [businessName, businessType || null, industry || null, website || null, country || null, phone || null, Number(userId)]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error("Error updating business profile", error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
};
