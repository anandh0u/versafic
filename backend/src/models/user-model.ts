// src/models/user-model.ts
import { Pool, QueryResult } from "pg";
import { executeQuery, executeQuerySingle, executeQueryMany } from "../utils/db-query";

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export class UserModel {
  constructor(private pool: Pool) {}

  async findById(id: number): Promise<User | null> {
    return executeQuerySingle<User>(
      this.pool,
      "SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return executeQuerySingle<User>(
      this.pool,
      "SELECT id, email, name, created_at, updated_at FROM users WHERE email = $1",
      [email]
    );
  }

  async findAll(limit: number = 10, offset: number = 0): Promise<User[]> {
    return executeQueryMany<User>(
      this.pool,
      "SELECT id, email, name, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
  }

  async create(email: string, name: string): Promise<User> {
    const result = await executeQuerySingle<User>(
      this.pool,
      "INSERT INTO users (email, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id, email, name, created_at, updated_at",
      [email, name]
    );
    
    if (!result) {
      throw new Error("Failed to create user");
    }
    
    return result;
  }

  async update(id: number, email: string, name: string): Promise<User | null> {
    return executeQuerySingle<User>(
      this.pool,
      "UPDATE users SET email = $1, name = $2, updated_at = NOW() WHERE id = $3 RETURNING id, email, name, created_at, updated_at",
      [email, name, id]
    );
  }

  async delete(id: number): Promise<boolean> {
    const result = await executeQuery(
      this.pool,
      "DELETE FROM users WHERE id = $1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getTotalCount(): Promise<number> {
    const result = await this.pool.query("SELECT COUNT(*) as count FROM users");
    return parseInt(result.rows[0]?.count ?? 0, 10);
  }
}
