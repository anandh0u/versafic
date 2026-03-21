import { pool } from "../config/database";
import { CallSessionRepository } from "./call-session.repository";
import { AIInteractionRepository } from "./ai-interaction.repository";

// Singleton repository instances
export const callSessionRepo = new CallSessionRepository(pool);
export const aiInteractionRepo = new AIInteractionRepository(pool);

export { CallSessionRepository } from "./call-session.repository";
export { AIInteractionRepository } from "./ai-interaction.repository";
export { BaseRepository } from "./base.repository";
