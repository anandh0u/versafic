// src/utils/logger.ts

// Sensitive field names (lowercase) that should never appear in logs
const SENSITIVE_FIELDS = new Set([
  "password",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "apikey",
  "api_key",
  "apisecret",
  "api_secret",
  "secret",
  "authorization",
  "cookie",
  "creditcard",
  "credit_card",
  "ssn",
  "cardnumber",
  "card_number",
  "cvv",
  "pin",
  "authtoken",
  "auth_token",
]);

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL_NAMES = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
} as const;

export interface LogContext {
  requestId?: string;
  userId?: number;
  callSessionId?: string;
  sessionId?: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  env: string;
  context?: LogContext;
  data?: Record<string, unknown>;
  error?: string;
}

function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  switch (envLevel) {
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    default:
      return process.env.NODE_ENV === "production"
        ? LogLevel.INFO
        : LogLevel.DEBUG;
  }
}

/** Recursively redact sensitive fields from an object before logging. */
function sanitize(obj: unknown, depth: number = 0): unknown {
  if (depth > 10) return "[max depth]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitize(value, depth + 1);
    }
  }
  return sanitized;
}

class Logger {
  private isDev = process.env.NODE_ENV !== "production";
  private minLevel = getMinLogLevel();
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /** Create a child logger that carries additional context fields. */
  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }

  // ------------------------------------------------------------------
  // Core logging methods — signature-compatible with the original API
  // ------------------------------------------------------------------

  debug(message: string, data?: any): void {
    this.write(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.write(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.write(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: any): void {
    this.write(LogLevel.ERROR, message, data, error);
  }

  // ------------------------------------------------------------------
  // Performance timing
  // ------------------------------------------------------------------

  /**
   * Start a timer for an operation. Returns a function that, when called,
   * logs the elapsed time and returns the duration in milliseconds.
   */
  startTimer(operationName: string): () => number {
    const start = Date.now();
    return () => {
      const durationMs = Date.now() - start;
      this.info(`${operationName} completed`, { operationName, durationMs });
      return durationMs;
    };
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private write(
    level: LogLevel,
    message: string,
    data?: unknown,
    error?: Error,
  ): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      message,
      env: process.env.NODE_ENV || "development",
    };

    // Attach context if present
    const ctxKeys = Object.keys(this.context);
    if (ctxKeys.length > 0) {
      entry.context = this.context;
    }

    // Sanitize and attach data
    if (data !== undefined && data !== null) {
      const safe = sanitize(data);
      if (typeof safe === "object" && safe !== null && !Array.isArray(safe)) {
        entry.data = safe as Record<string, unknown>;
      } else {
        entry.data = { value: safe };
      }
    }

    // Attach error info
    if (error) {
      entry.error =
        error instanceof Error
          ? (error.stack ?? error.message)
          : String(error);
    }

    const formatted = this.format(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
        break;
    }
  }

  private format(entry: LogEntry): string {
    if (!this.isDev) {
      // Production: single-line JSON for log aggregators
      return JSON.stringify(entry);
    }

    // Development: human-readable pretty output
    const parts: string[] = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      entry.message,
    ];

    const meta: Record<string, unknown> = {};
    if (entry.context) Object.assign(meta, entry.context);
    if (entry.data) Object.assign(meta, entry.data);
    if (entry.error) meta.error = entry.error;

    if (Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta, null, 2));
    }

    return parts.join(" ");
  }
}

export const logger = new Logger();
