// src/types/index.ts

export interface ApiResponse<T> {
  status: "success" | "error";
  statusCode: number;
  message: string;
  data?: T;
  timestamp: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface DatabaseError {
  code?: string;
  message: string;
  detail?: string;
  constraint?: string;
}

export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  CONFLICT = "CONFLICT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  MISSING_TOKEN = "MISSING_TOKEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  AUTH_ERROR = "AUTH_ERROR",
  USER_EXISTS = "USER_EXISTS",
  REGISTRATION_ERROR = "REGISTRATION_ERROR",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  LOGIN_ERROR = "LOGIN_ERROR",
  GOOGLE_AUTH_ERROR = "GOOGLE_AUTH_ERROR",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND",
  SETUP_ERROR = "SETUP_ERROR",
  GET_PROFILE_ERROR = "GET_PROFILE_ERROR",
  STATUS_ERROR = "STATUS_ERROR",
  INSUFFICIENT_CREDITS = "INSUFFICIENT_CREDITS",
  PAYMENT_ERROR = "PAYMENT_ERROR"
}
