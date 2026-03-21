import { logger } from "./logger";

export const validateEnv = (): void => {
  const requiredVars = [
    "PORT",
    "NODE_ENV",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET"
  ];

  // AI feature is optional, but log if missing
  const optionalButRecommended = [
    "OPENAI_API_KEY",
    "SARVAM_API_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "PUBLIC_BASE_URL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER"
  ];

  const missingRequired = requiredVars.filter((variable) => !process.env[variable]);
  const missingOptional = optionalButRecommended.filter((variable) => !process.env[variable]);

  if (missingRequired.length > 0) {
    logger.error(`Missing required environment variables: ${missingRequired.join(", ")}`);
    process.exit(1);
  }

  if (missingOptional.length > 0) {
    logger.warn(`Missing optional environment variables: ${missingOptional.join(", ")}. Some features may not work.`);
  }

  // Validate JWT_SECRET length for production
  const jwtSecret = process.env.JWT_SECRET || "";
  if (jwtSecret.length < 32 && process.env.NODE_ENV === "production") {
    logger.warn("JWT_SECRET is less than 32 characters. This is not recommended for production.");
  }

  // Validate database port is a valid number
  const dbPort = process.env.DB_PORT;
  if (dbPort && isNaN(Number(dbPort))) {
    logger.error("DB_PORT must be a valid number");
    process.exit(1);
  }

  // Validate port is a valid number
  const port = process.env.PORT;
  if (port && isNaN(Number(port))) {
    logger.error("PORT must be a valid number");
    process.exit(1);
  }

  logger.info("✅ Environment variables validated");
};

export const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    logger.error(`Environment variable ${key} is not set`);
    process.exit(1);
  }
  return value;
};

/**
 * Get optional environment variable with default
 */
export const getOptionalEnv = (key: string, defaultValue: string = ""): string => {
  return process.env[key] || defaultValue;
};
