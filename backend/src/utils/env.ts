import { logger } from "./logger";

export const normalizeEnvValue = (value?: string | null): string => {
  if (typeof value !== "string") {
    return "";
  }

  let normalized = value.trim();

  if (
    (normalized.startsWith("\"") && normalized.endsWith("\"")) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized.replace(/\\r\\n|\\n|\\r/g, "").trim();
};

export const isPlaceholderEnvValue = (value?: string | null): boolean => {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    return true;
  }

  return /^(your_|replace_|paste_)/i.test(normalized) || normalized.includes("_here");
};

export const validateEnv = (): void => {
  const hasDatabaseUrl = Boolean(normalizeEnvValue(process.env.DATABASE_URL));
  const requiredVars = [
    "PORT",
    "NODE_ENV",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET"
  ];
  const requiredDbVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];

  // AI feature is optional, but log if missing
  const optionalButRecommended = [
    "DATABASE_URL",
    "OPENAI_API_KEY",
    "SARVAM_API_KEY",
    "FRONTEND_BASE_URL",
    "APP_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_CALLBACK_URL",
    "MAILGUN_API_KEY",
    "MAILGUN_DOMAIN",
    "MAILGUN_FROM",
    "MAILGUN_BASE_URL",
    "PUBLIC_BASE_URL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "EXOTEL_SID",
    "EXOTEL_API_KEY",
    "EXOTEL_API_TOKEN",
    "EXOTEL_NUMBER",
    "EXOTEL_API_BASE_URL",
    "EXOTEL_CALL_FLOW_URL",
    "EXOTEL_INTERNAL_API_KEY"
  ];

  const missingRequired = requiredVars.filter((variable) => !normalizeEnvValue(process.env[variable]));
  const missingDbVars = hasDatabaseUrl
    ? []
    : requiredDbVars.filter((variable) => !normalizeEnvValue(process.env[variable]));
  const missingOptional = optionalButRecommended.filter((variable) => !process.env[variable]);

  if (missingRequired.length > 0 || missingDbVars.length > 0) {
    const allMissing = [...missingRequired, ...missingDbVars];
    logger.error(`Missing required environment variables: ${allMissing.join(", ")}`);
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
  const dbPort = normalizeEnvValue(process.env.DB_PORT);
  if (!hasDatabaseUrl && dbPort && isNaN(Number(dbPort))) {
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
  const value = normalizeEnvValue(process.env[key] || defaultValue);
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
  return normalizeEnvValue(process.env[key] || defaultValue);
};
