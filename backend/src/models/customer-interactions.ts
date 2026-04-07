/**
 * Customer Service Models
 * Database queries for storing and retrieving customer interactions
 */

import { pool } from '../config/database';
import { logger } from '../utils/logger';

export interface CustomerInteraction {
  id: string;
  session_id: string;
  user_id?: string;
  customer_message: string;
  ai_response: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  is_resolved: boolean;
  created_at: Date;
}

let customerInteractionsTableReady: Promise<void> | null = null;

const ensureCustomerInteractionsTable = async (): Promise<void> => {
  if (!customerInteractionsTableReady) {
    customerInteractionsTableReady = pool
      .query(customerInteractionsTableSQL)
      .then(() => undefined)
      .catch((error) => {
        customerInteractionsTableReady = null;
        throw error;
      });
  }

  await customerInteractionsTableReady;
};

/**
 * Create customer interaction record
 */
export const createInteraction = async (
  sessionId: string,
  customerMessage: string,
  aiResponse: string,
  sentiment: 'positive' | 'negative' | 'neutral',
  isResolved: boolean,
  customerData?: {
    name?: string;
    phone?: string;
    email?: string;
  }
): Promise<CustomerInteraction> => {
  await ensureCustomerInteractionsTable();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `INSERT INTO customer_interactions 
        (session_id, customer_message, ai_response, sentiment, customer_name, customer_phone, customer_email, is_resolved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        sessionId,
        customerMessage,
        aiResponse,
        sentiment,
        customerData?.name || null,
        customerData?.phone || null,
        customerData?.email || null,
        isResolved
      ]
    );

    logger.info('Customer interaction saved', { sessionId, sentiment });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to save customer interaction', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get session interactions
 */
export const getSessionInteractions = async (sessionId: string): Promise<CustomerInteraction[]> => {
  await ensureCustomerInteractionsTable();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM customer_interactions 
       WHERE session_id = $1 
       ORDER BY created_at ASC`,
      [sessionId]
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch session interactions', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get interactions by phone number
 */
export const getInteractionsByPhone = async (phone: string): Promise<CustomerInteraction[]> => {
  await ensureCustomerInteractionsTable();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM customer_interactions 
       WHERE customer_phone = $1 
       ORDER BY created_at DESC`,
      [phone]
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch interactions by phone', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get interactions by email
 */
export const getInteractionsByEmail = async (email: string): Promise<CustomerInteraction[]> => {
  await ensureCustomerInteractionsTable();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM customer_interactions 
       WHERE customer_email = $1 
       ORDER BY created_at DESC`,
      [email]
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch interactions by email', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get resolved interactions
 */
export const getResolvedInteractions = async (limit: number = 100): Promise<CustomerInteraction[]> => {
  await ensureCustomerInteractionsTable();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM customer_interactions 
       WHERE is_resolved = true 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch resolved interactions', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get unresolved interactions
 */
export const getUnresolvedInteractions = async (limit: number = 100): Promise<CustomerInteraction[]> => {
  await ensureCustomerInteractionsTable();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM customer_interactions 
       WHERE is_resolved = false 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch unresolved interactions', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get sentiment statistics
 */
export const getSentimentStats = async (): Promise<{
  positive: number;
  negative: number;
  neutral: number;
}> => {
  await ensureCustomerInteractionsTable();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT sentiment, COUNT(*) as count 
       FROM customer_interactions 
       GROUP BY sentiment`
    );

    const stats = { positive: 0, negative: 0, neutral: 0 };

    for (const row of result.rows) {
      stats[row.sentiment as keyof typeof stats] = parseInt(row.count, 10);
    }

    return stats;
  } catch (error) {
    logger.error('Failed to fetch sentiment stats', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get resolution rate
 */
export const getResolutionRate = async (): Promise<{
  resolved: number;
  unresolved: number;
  rate: number;
}> => {
  await ensureCustomerInteractionsTable();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT is_resolved, COUNT(*) as count 
       FROM customer_interactions 
       GROUP BY is_resolved`
    );

    let resolved = 0;
    let unresolved = 0;

    for (const row of result.rows) {
      if (row.is_resolved) {
        resolved = parseInt(row.count, 10);
      } else {
        unresolved = parseInt(row.count, 10);
      }
    }

    const total = resolved + unresolved;
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return { resolved, unresolved, rate };
  } catch (error) {
    logger.error('Failed to fetch resolution rate', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Create migration SQL for customer interactions table
 */
export const customerInteractionsTableSQL = `
CREATE TABLE IF NOT EXISTS customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
`;
