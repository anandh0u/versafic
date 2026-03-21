// src/config/database.ts
import { Pool } from "pg";
import dotenv from "dotenv";
import { logger } from "../utils/logger";

dotenv.config();

// Validate required database environment variables
const requiredDbVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingVars = requiredDbVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  logger.error(`Missing required database environment variables: ${missingVars.join(", ")}`);
  process.exit(1);
}

// SSL configuration for Aiven cloud database
const getSslConfig = (): { rejectUnauthorized: boolean; ca?: string } | false => {
  const dbHost = process.env.DB_HOST || "";
  const isAiven = dbHost.includes("aivencloud.com");
  const isProduction = process.env.NODE_ENV === "production";

  // Aiven always requires SSL
  if (isAiven || isProduction) {
    const config: { rejectUnauthorized: boolean; ca?: string } = {
      rejectUnauthorized: isProduction
    };
    // Support Aiven CA certificate for production verification
    if (process.env.DB_SSL_CA) {
      config.ca = process.env.DB_SSL_CA;
      config.rejectUnauthorized = true;
    }
    return config;
  }

  // Local development without Aiven — no SSL needed
  return false;
};

// Create single database pool instance (reused throughout app)
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Connection pooling configuration
  max: 20, // Maximum number of connections in the pool
  min: 2, // Minimum number of idle connections kept alive
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 15000, // How long to wait when connecting a new client
  maxUses: 7500, // Max number of requests a connection can have
  
  // Keep alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 30000, // Delay before sending TCP keep-alive probe
  
  // Statement timeout for queries
  statement_timeout: 30000, // Cancel query if it takes longer than 30s
  
  // SSL configuration for Aiven
  ssl: getSslConfig()
});

// Connection pool error handler
pool.on("error", (err: Error) => {
  logger.error("Unexpected error on idle connection", err instanceof Error ? err : new Error(String(err)));
});

// Log pool events in development
pool.on("connect", () => {
  logger.debug("New connection established");
});

pool.on("remove", () => {
  logger.debug("Connection removed from pool");
});

// Retry logic for database connection
export const initializeDatabase = async (): Promise<void> => {
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds
  const dbHost = process.env.DB_HOST || "unknown";
  const isAiven = dbHost.includes("aivencloud.com");

  logger.info("Connecting to database", {
    host: dbHost,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    cloud: isAiven ? "Aiven" : "local",
    ssl: isAiven ? "enabled" : "disabled"
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      const result = await client.query("SELECT NOW(), current_database(), current_user");
      client.release();
      
      const row = result.rows[0];
      logger.info("✅ Database connection verified", {
        timestamp: row.now,
        database: row.current_database,
        user: row.current_user,
        host: dbHost,
        cloud: isAiven ? "Aiven" : "local",
        attempt
      });

      // Run migrations to create required tables
      const { runMigrations } = await import("../utils/migrate");
      await runMigrations();
      
      return;
    } catch (error) {
      logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed`, {
        host: dbHost,
        error: error instanceof Error ? error.message : String(error)
      });

      if (attempt === maxRetries) {
        const errorMsg = `Failed to connect to database at ${dbHost} after ${maxRetries} attempts`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
};

/**
 * Create required tables if they don't exist
 */
export const createRequiredTables = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    // Create customer interactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(255) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        customer_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral')) DEFAULT 'neutral',
        customer_name VARCHAR(255),
        customer_phone VARCHAR(20),
        customer_email VARCHAR(255),
        is_resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_session_id ON customer_interactions(session_id);
      CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer_interactions(customer_phone);
      CREATE INDEX IF NOT EXISTS idx_customer_email ON customer_interactions(customer_email);
      CREATE INDEX IF NOT EXISTS idx_sentiment ON customer_interactions(sentiment);
      CREATE INDEX IF NOT EXISTS idx_is_resolved ON customer_interactions(is_resolved);
      CREATE INDEX IF NOT EXISTS idx_created_at ON customer_interactions(created_at);
    `);

    logger.info("✅ Required tables created/verified");
  } catch (error) {
    logger.error("Error creating required tables", error instanceof Error ? error : new Error(String(error)));
  } finally {
    client.release();
  }
};

// Graceful pool shutdown
export const shutdownDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info("Database pool closed successfully");
  } catch (error) {
    logger.error("Error closing database pool", error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * Get the public base URL for webhook callbacks
 * Centralized helper to manage Twilio webhook URLs
 * Supports ngrok dynamic URLs and production domains
 */
export const getPublicUrl = (path: string): string => {
  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (!baseUrl) {
    const fallback = `http://localhost:${process.env.PORT || 5000}${path}`;
    logger.warn('PUBLIC_BASE_URL not set, using localhost', { path, fallback });
    return fallback;
  }
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
};

/**
 * Validate Twilio webhook and credential configuration
 */
export const validateTwilioWebhookConfig = (): void => {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (publicBaseUrl) {
    logger.info('✅ Twilio webhook URLs ready', {
      publicBaseUrl,
      incomingUrl: getPublicUrl('/call/incoming'),
      recordingUrl: getPublicUrl('/call/recording')
    });
  } else {
    logger.warn('⚠️ PUBLIC_BASE_URL not configured', {
      message: 'Twilio webhooks will use http://localhost:5000',
      instruction: 'Set PUBLIC_BASE_URL in .env for ngrok or production'
    });
  }

  if (accountSid && authToken && phoneNumber) {
    logger.info('✅ Twilio credentials configured', {
      accountSid: accountSid.substring(0, 8) + '...',
      phoneNumber
    });
  } else {
    logger.warn('⚠️ Twilio configuration incomplete', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasPhoneNumber: !!phoneNumber,
      instruction: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env'
    });
  }
};
