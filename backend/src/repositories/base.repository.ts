import { Pool, QueryResult } from "pg";
import { logger } from "../utils/logger";

export abstract class BaseRepository {
  constructor(protected pool: Pool) {}

  protected async query<T extends Record<string, any> = any>(
    text: string,
    values?: any[]
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    try {
      const result = await this.pool.query<T>(text, values);
      const duration = Date.now() - startTime;
      logger.debug("DB query executed", {
        duration: `${duration}ms`,
        rowCount: result.rowCount
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("DB query failed", error instanceof Error ? error : new Error(String(error)), {
        duration: `${duration}ms`,
        query: text.substring(0, 100)
      });
      throw error;
    }
  }

  protected async queryOne<T extends Record<string, any> = any>(
    text: string,
    values?: any[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, values);
    return result.rows[0] || null;
  }

  protected async queryMany<T extends Record<string, any> = any>(
    text: string,
    values?: any[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, values);
    return result.rows;
  }
}
