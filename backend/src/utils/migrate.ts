import { pool } from "../config/database";
import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

/**
 * Run database migrations in order
 * Uses a migrations tracking table to only run new migrations
 */
export const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get already-executed migrations
    const executed = await client.query("SELECT name FROM _migrations ORDER BY id");
    const executedSet = new Set(executed.rows.map((r: any) => r.name));

    const migrationsDir = path.join(__dirname, "../../migrations");
    const files = fs.readdirSync(migrationsDir).sort();

    let newMigrations = 0;

    for (const file of files) {
      if (!file.endsWith(".sql")) continue;
      if (executedSet.has(file)) continue;

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      logger.info(`Running migration: ${file}`);

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        newMigrations++;
        logger.info(`✅ Migration completed: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Migration failed: ${file}`, new Error(errorMsg));
        throw error;
      }
    }

    if (newMigrations === 0) {
      logger.info("Database is up to date — no new migrations");
    } else {
      logger.info(`✅ ${newMigrations} migration(s) completed successfully`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Migration runner error", new Error(errorMsg));
    throw error;
  } finally {
    client.release();
  }
};
