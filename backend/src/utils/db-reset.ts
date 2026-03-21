import { pool } from "../config/database";
import { logger } from "./logger";

/**
 * Reset database - drop all tables
 */
export const resetDatabase = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    logger.info("Resetting database - dropping all tables...");

    await client.query(`
      DROP TABLE IF EXISTS customer_interactions CASCADE;
      DROP TABLE IF EXISTS chat_history CASCADE;
      DROP TABLE IF EXISTS business_profiles CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_users_timestamp() CASCADE;
      DROP FUNCTION IF EXISTS update_business_profiles_timestamp() CASCADE;
    `);

    logger.info("✅ Database reset completed");
  } catch (error) {
    logger.error("Error resetting database", error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};
