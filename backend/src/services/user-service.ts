// src/services/user-service.ts
import { Pool } from "pg";
import { UserModel, User } from "../models/user-model";
import { AppError } from "../middleware/error-handler";
import { ErrorCode } from "../types";

export class UserService {
  private userModel: UserModel;

  constructor(pool: Pool) {
    this.userModel = new UserModel(pool);
  }

  async getUserById(id: number): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, `User with id ${id} not found`);
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userModel.findByEmail(email);
    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, `User with email ${email} not found`);
    }
    return user;
  }

  async listUsers(page: number = 1, limit: number = 10): Promise<{
    users: User[];
    page: number;
    limit: number;
    total: number;
  }> {
    const offset = (page - 1) * limit;
    const users = await this.userModel.findAll(limit, offset);
    
    // Get total count from database, not from array length
    const countResult = await this.userModel.getTotalCount();
    
    return {
      users,
      page,
      limit,
      total: countResult
    };
  }

  async createUser(email: string, name: string): Promise<User> {
    // Check if user exists
    const existing = await this.userModel.findByEmail(email);
    if (existing) {
      throw new AppError(409, ErrorCode.CONFLICT, `User with email ${email} already exists`);
    }

    // Validate input
    if (!email || !name) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Email and name are required");
    }

    return this.userModel.create(email, name);
  }

  async updateUser(id: number, email: string, name: string): Promise<User> {
    // Check if user exists
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, `User with id ${id} not found`);
    }

    // Validate input
    if (!email || !name) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Email and name are required");
    }

    // Check if new email is already taken by another user
    const existing = await this.userModel.findByEmail(email);
    if (existing && existing.id !== id) {
      throw new AppError(409, ErrorCode.CONFLICT, `Email ${email} is already taken`);
    }

    const updated = await this.userModel.update(id, email, name);
    if (!updated) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, "Failed to update user");
    }

    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, `User with id ${id} not found`);
    }

    const deleted = await this.userModel.delete(id);
    if (!deleted) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, "Failed to delete user");
    }
  }
}
