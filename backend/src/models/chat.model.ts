// src/models/chat.model.ts
import { pool } from "../config/database";
import { logger } from "../utils/logger";

export interface ChatMessage {
  id?: number;
  userId: number;
  message: string;
  response: string;
  tokensUsed?: number;
  createdAt?: Date;
}

let chatHistoryReady: Promise<void> | null = null;

const ensureChatHistoryTable = async (): Promise<void> => {
  if (!chatHistoryReady) {
    chatHistoryReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_history (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          message TEXT NOT NULL,
          response TEXT NOT NULL,
          tokens_used INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_history(created_at);
        CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_history(user_id, created_at DESC);
      `);
    })().catch((error) => {
      chatHistoryReady = null;
      throw error;
    });
  }

  await chatHistoryReady;
};

export const saveChatMessage = async (
  userId: number,
  message: string,
  response: string,
  tokensUsed: number = 0
): Promise<ChatMessage | null> => {
  try {
    await ensureChatHistoryTable();

    const result = await pool.query(
      `INSERT INTO chat_history (user_id, message, response, tokens_used, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, user_id, message, response, tokens_used, created_at`,
      [userId, message, response, tokensUsed]
    );
    
    return result.rows[0] as ChatMessage;
  } catch (error) {
    logger.error("Error saving chat message", error instanceof Error ? error : new Error(String(error)));
    throw new Error("Failed to save chat message");
  }
};

export const getChatHistory = async (
  userId: number,
  limit: number = 10,
  offset: number = 0
): Promise<ChatMessage[]> => {
  try {
    await ensureChatHistoryTable();

    const result = await pool.query(
      `SELECT id, user_id, message, response, tokens_used, created_at
       FROM chat_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    return result.rows as ChatMessage[];
  } catch (error) {
    logger.error("Error fetching chat history", error instanceof Error ? error : new Error(String(error)));
    throw new Error("Failed to fetch chat history");
  }
};

export const getUserChatStats = async (userId: number): Promise<{ totalMessages: number; totalTokens: number }> => {
  try {
    await ensureChatHistoryTable();

    const result = await pool.query(
      `SELECT COUNT(*) as total_messages, COALESCE(SUM(tokens_used), 0) as total_tokens
       FROM chat_history
       WHERE user_id = $1`,
      [userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      throw new Error("Failed to retrieve chat stats");
    }
    
    return {
      totalMessages: parseInt(result.rows[0].total_messages, 10),
      totalTokens: parseInt(result.rows[0].total_tokens, 10)
    };
  } catch (error) {
    logger.error("Error fetching chat stats", error instanceof Error ? error : new Error(String(error)));
    throw new Error("Failed to fetch chat stats");
  }
};

export const deleteChatHistory = async (userId: number): Promise<boolean> => {
  try {
    await ensureChatHistoryTable();

    const result = await pool.query(
      `DELETE FROM chat_history WHERE user_id = $1`,
      [userId]
    );
    
    return typeof result.rowCount === "number";
  } catch (error) {
    logger.error("Error deleting chat history", error instanceof Error ? error : new Error(String(error)));
    throw new Error("Failed to delete chat history");
  }
};
