import { BaseRepository } from "./base.repository";
import { Pool } from "pg";
import { logger } from "../utils/logger";

export interface AIInteraction {
  id: string;
  user_id?: number;
  session_id?: string;
  provider: string;
  model?: string;
  interaction_type: string;
  input_text: string;
  output_text?: string;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  latency_ms?: number;
  status: string;
  error_message?: string;
  metadata: Record<string, any>;
  cached: boolean;
  created_at: string;
}

export type AIInteractionType = "chat" | "customer_service" | "intent" | "extraction" | "stt" | "tts";

export class AIInteractionRepository extends BaseRepository {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(data: {
    userId?: number;
    sessionId?: string;
    provider: string;
    model?: string;
    interactionType: AIInteractionType;
    inputText: string;
    outputText?: string;
    tokensInput?: number;
    tokensOutput?: number;
    tokensTotal?: number;
    latencyMs?: number;
    status?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
    cached?: boolean;
  }): Promise<AIInteraction> {
    const result = await this.queryOne<AIInteraction>(
      `INSERT INTO ai_interactions 
        (user_id, session_id, provider, model, interaction_type, input_text, output_text, 
         tokens_input, tokens_output, tokens_total, latency_ms, status, error_message, metadata, cached)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        data.userId ?? null,
        data.sessionId ?? null,
        data.provider,
        data.model ?? null,
        data.interactionType,
        data.inputText,
        data.outputText ?? null,
        data.tokensInput ?? 0,
        data.tokensOutput ?? 0,
        data.tokensTotal ?? 0,
        data.latencyMs ?? null,
        data.status ?? "success",
        data.errorMessage ?? null,
        JSON.stringify(data.metadata ?? {}),
        data.cached ?? false
      ]
    );
    if (!result) throw new Error("Failed to create AI interaction");
    return result;
  }

  async getByUserId(userId: number, limit: number = 50, offset: number = 0): Promise<AIInteraction[]> {
    return this.queryMany<AIInteraction>(
      `SELECT * FROM ai_interactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }

  async getUsageStats(userId?: number): Promise<{
    totalInteractions: number;
    totalTokens: number;
    avgLatencyMs: number;
    byProvider: Record<string, number>;
    byType: Record<string, number>;
    cachedCount: number;
    errorCount: number;
  }> {
    const whereClause = userId ? "WHERE user_id = $1" : "";
    const values = userId ? [userId] : [];

    const result = await this.queryOne<any>(
      `SELECT 
        COUNT(*) as total,
        COALESCE(SUM(tokens_total), 0) as total_tokens,
        COALESCE(AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL), 0) as avg_latency,
        COUNT(CASE WHEN cached = true THEN 1 END) as cached_count,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count
       FROM ai_interactions ${whereClause}`,
      values
    );

    const providerStats = await this.queryMany<any>(
      `SELECT provider, COUNT(*) as count FROM ai_interactions ${whereClause} GROUP BY provider`,
      values
    );

    const typeStats = await this.queryMany<any>(
      `SELECT interaction_type, COUNT(*) as count FROM ai_interactions ${whereClause} GROUP BY interaction_type`,
      values
    );

    const byProvider: Record<string, number> = {};
    for (const row of providerStats) {
      byProvider[row.provider] = parseInt(row.count, 10);
    }

    const byType: Record<string, number> = {};
    for (const row of typeStats) {
      byType[row.interaction_type] = parseInt(row.count, 10);
    }

    return {
      totalInteractions: parseInt(result?.total ?? 0, 10),
      totalTokens: parseInt(result?.total_tokens ?? 0, 10),
      avgLatencyMs: parseFloat(result?.avg_latency ?? 0),
      byProvider,
      byType,
      cachedCount: parseInt(result?.cached_count ?? 0, 10),
      errorCount: parseInt(result?.error_count ?? 0, 10)
    };
  }
}
