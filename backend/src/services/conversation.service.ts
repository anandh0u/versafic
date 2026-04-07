import { pool } from "../config/database";
import { logger } from "../utils/logger";

export interface Conversation {
  id: string;
  customer_name?: string;
  phone?: string;
  email?: string;
  request?: string;
  ai_response: string;
  transcript?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateConversationInput {
  customer_name?: string;
  phone?: string;
  email?: string;
  request?: string;
  ai_response: string;
  transcript?: string;
}

class ConversationService {
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize conversations table
   */
  async initializeTable(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        try {
          const createTableQuery = `
            CREATE TABLE IF NOT EXISTS conversations (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              customer_name VARCHAR(255),
              phone VARCHAR(20),
              email VARCHAR(255),
              request TEXT,
              ai_response TEXT NOT NULL,
              transcript TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
            CREATE INDEX IF NOT EXISTS idx_conversations_email ON conversations(email);
            CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
          `;

          const statements = createTableQuery
            .split(";")
            .filter((stmt) => stmt.trim());

          for (const statement of statements) {
            await pool.query(statement);
          }

          logger.info("Conversations table initialized");
        } catch (error) {
          this.initializationPromise = null;
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error("Failed to initialize conversations table", err);
          throw error;
        }
      })();
    }

    await this.initializationPromise;
  }

  /**
   * Create a new conversation record
   */
  async createConversation(
    data: CreateConversationInput
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      await this.initializeTable();

      const query = `
        INSERT INTO conversations (
          customer_name,
          phone,
          email,
          request,
          ai_response,
          transcript
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `;

      const values = [
        data.customer_name || null,
        data.phone || null,
        data.email || null,
        data.request || null,
        data.ai_response,
        data.transcript || null
      ];

      const result = await pool.query(query, values);
      const conversationId = result.rows[0]?.id;

      logger.info("Conversation created", {
        id: conversationId,
        hasPhone: !!data.phone
      });

      return {
        success: true,
        id: conversationId
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to create conversation", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get conversations by phone
   */
  async getConversationsByPhone(phone: string): Promise<{
    success: boolean;
    conversations?: Conversation[];
    error?: string;
  }> {
    try {
      await this.initializeTable();

      const query = `
        SELECT * FROM conversations
        WHERE phone = $1
        ORDER BY created_at DESC
        LIMIT 50;
      `;

      const result = await pool.query(query, [phone]);

      logger.info("Retrieved conversations by phone", {
        phone,
        count: result.rows.length
      });

      return {
        success: true,
        conversations: result.rows
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get conversations by phone", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get conversations by email
   */
  async getConversationsByEmail(email: string): Promise<{
    success: boolean;
    conversations?: Conversation[];
    error?: string;
  }> {
    try {
      await this.initializeTable();

      const query = `
        SELECT * FROM conversations
        WHERE email = $1
        ORDER BY created_at DESC
        LIMIT 50;
      `;

      const result = await pool.query(query, [email]);

      logger.info("Retrieved conversations by email", {
        email,
        count: result.rows.length
      });

      return {
        success: true,
        conversations: result.rows
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get conversations by email", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(id: string): Promise<{
    success: boolean;
    conversation?: Conversation;
    error?: string;
  }> {
    try {
      await this.initializeTable();

      const query = `
        SELECT * FROM conversations
        WHERE id = $1;
      `;

      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: "Conversation not found"
        };
      }

      return {
        success: true,
        conversation: result.rows[0]
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get conversation by ID", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(limit: number = 20): Promise<{
    success: boolean;
    conversations?: Conversation[];
    error?: string;
  }> {
    try {
      await this.initializeTable();

      const query = `
        SELECT * FROM conversations
        ORDER BY created_at DESC
        LIMIT $1;
      `;

      const result = await pool.query(query, [limit]);

      return {
        success: true,
        conversations: result.rows
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get recent conversations", err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get conversation statistics
   */
  async getStatistics(): Promise<{
    success: boolean;
    stats?: {
      total: number;
      with_name: number;
      with_phone: number;
      with_email: number;
      today: number;
    };
    error?: string;
  }> {
    try {
      await this.initializeTable();

      const query = `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN customer_name IS NOT NULL THEN 1 END) as with_name,
          COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as with_phone,
          COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email,
          COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today
        FROM conversations;
      `;

      const result = await pool.query(query);
      const row = result.rows[0];

      return {
        success: true,
        stats: {
          total: parseInt(row.total),
          with_name: parseInt(row.with_name),
          with_phone: parseInt(row.with_phone),
          with_email: parseInt(row.with_email),
          today: parseInt(row.today)
        }
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get conversation statistics", err);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

// Export singleton
export const conversationService = new ConversationService();
