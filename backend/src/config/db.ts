import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  logger.error(
    "Missing required environment variables",
    new Error(`Missing: ${missingVars.join(", ")}`)
  );
  process.exit(1);
}

// Create connection pool
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Production pool settings
  max: 20, // Maximum number of connections
  min: 2, // Minimum number of idle connections
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  connectionTimeoutMillis: 15000, // Timeout for connection attempts
  statement_timeout: 30000, // Query timeout
  ssl: (process.env.DB_HOST || "").includes("aivencloud.com")
    ? { rejectUnauthorized: process.env.NODE_ENV === "production" }
    : false
});

// Handle pool errors
pool.on("error", (err: Error, client: PoolClient) => {
  logger.error("Unexpected error on idle database client", err, {
    client: client.constructor.name
  });
});

// Monitor pool
pool.on("connect", () => {
  logger.debug("New database connection established");
});

pool.on("remove", () => {
  logger.debug("Database connection removed from pool");
});

// Test connection on startup
export const initializeDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();
    logger.info("✅ Database connection verified", {
      timestamp: result.rows[0].now
    });
  } catch (error) {
    logger.error(
      "❌ Failed to connect to database",
      error as Error,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME
      }
    );
    throw error;
  }
};
