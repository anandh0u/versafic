/**
 * Database Migration Runner
 * 
 * This utility helps run SQL migration files against the PostgreSQL database.
 * Usage: npx ts-node src/utils/run-migrations.ts
 * 
 * Migrations should be placed in the migrations/ directory and named sequentially:
 * - 001_create_users_table.sql
 * - 002_create_business_profiles_table.sql
 * etc.
 */

import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const migrationsDir = path.join(__dirname, '../../migrations');

const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();
  
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('schema_migrations table ensured');

    // Get list of migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.info('No migration files found');
      return;
    }

    // Run each migration that hasn't been executed
    for (const file of files) {
      const migrationName = file;
      
      // Check if migration has already been run
      const result = await client.query(
        'SELECT id FROM schema_migrations WHERE migration_name = $1',
        [migrationName]
      );

      if (result.rows.length > 0) {
        logger.info(`Migration ${migrationName} already executed, skipping`);
        continue;
      }

      // Read and execute migration
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf-8');

      try {
        await client.query(sql);
        
        // Record migration as executed
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [migrationName]
        );
        
        logger.info(`✓ Migration ${migrationName} executed successfully`);
      } catch (error) {
        logger.error(`✗ Migration ${migrationName} failed:`, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration runner error:', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process finished');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration process failed:', error);
      process.exit(1);
    });
}

export { runMigrations };
