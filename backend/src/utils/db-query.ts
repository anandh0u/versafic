// src/utils/db-query.ts
import { Pool, QueryResult, QueryConfig } from "pg";
import { logger } from "./logger";

export class DatabaseError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export const executeQuery = async <T extends Record<string, any> = any>(
  pool: Pool,
  query: string | QueryConfig,
  values?: any[]
): Promise<QueryResult<T>> => {
  try {
    const startTime = Date.now();
    const result = await pool.query<T>(query, values);
    const duration = Date.now() - startTime;

    logger.debug("Database query executed", {
      duration: `${duration}ms`,
      rowCount: result.rowCount
    });

    return result;
  } catch (error) {
    logger.error("Database query failed", error as Error, {
      query: typeof query === "string" ? query : query.text,
      values
    });

    // Handle specific database errors
    if (error instanceof Error) {
      const pgError = error as any;
      if (pgError.code === "23505") {
        throw new DatabaseError("UNIQUE_VIOLATION", 409, "Resource already exists", error);
      }
      if (pgError.code === "23503") {
        throw new DatabaseError("FOREIGN_KEY_VIOLATION", 409, "Invalid reference", error);
      }
      if (pgError.code === "42P01") {
        throw new DatabaseError("TABLE_NOT_FOUND", 500, "Database table not found", error);
      }
    }

    throw new DatabaseError("QUERY_ERROR", 500, "Database query failed", error as Error);
  }
};

export const executeQuerySingle = async <T extends Record<string, any> = any>(
  pool: Pool,
  query: string | QueryConfig,
  values?: any[]
): Promise<T | null> => {
  const result = await executeQuery<T>(pool, query, values);
  return result.rows[0] || null;
};

export const executeQueryMany = async <T extends Record<string, any> = any>(
  pool: Pool,
  query: string | QueryConfig,
  values?: any[]
): Promise<T[]> => {
  const result = await executeQuery<T>(pool, query, values);
  return result.rows;
};
