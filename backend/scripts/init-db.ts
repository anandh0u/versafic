import { Client } from 'pg';
import { runMigrations } from '../src/utils/migrate';
import { pool } from '../src/config/database';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const resetAndInitialize = async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: false,  // Allow self-signed certificates for development
    },
  });

  try {
    await client.connect();
    logger.info('Connected to database');

    // Drop all tables and functions
    logger.info('Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS customer_interactions CASCADE;
      DROP TABLE IF EXISTS chat_history CASCADE;
      DROP TABLE IF EXISTS business_profiles CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_users_timestamp() CASCADE;
      DROP FUNCTION IF EXISTS update_business_profiles_timestamp() CASCADE;
    `);
    logger.info('✅ Tables dropped');

    await client.end();

    // Now run migrations using the pool
    logger.info('Running migrations...');
    await runMigrations();
    logger.info('✅ Migrations completed');

    // Close the pool
    await pool.end();
    logger.info('✅ Database initialization complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Error during initialization:', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
};

resetAndInitialize();
