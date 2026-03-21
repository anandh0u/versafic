// src/utils/response.ts
import { Response } from "express";
import { ApiResponse } from "../types";
import { logger } from "./logger";

/**
 * Send success response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = "Success",
  statusCode: number = 200
): Response => {
  const response: ApiResponse<T> = {
    status: "success",
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString()
  };
  logger.info(`Success response: ${statusCode} - ${message}`);
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  message: string = "Internal server error",
  statusCode: number = 500,
  errorCode?: string
): Response => {
  const response = {
    status: "error",
    statusCode,
    message,
    errorCode,
    timestamp: new Date().toISOString()
  };
  logger.error(`Error response: ${statusCode} - ${errorCode} - ${message}`);
  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  message: string = "Success",
  statusCode: number = 200
): Response => {
  const pages = Math.ceil(total / limit);
  const response = {
    status: "success",
    statusCode,
    message,
    data,
    pagination: {
      page,
      limit,
      total,
      pages
    },
    timestamp: new Date().toISOString()
  };
  logger.info(`Paginated response: ${statusCode} - page ${page} of ${pages}`);
  return res.status(statusCode).json(response);
};

/**
 * Send created response (201)
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  message: string = "Resource created successfully"
): Response => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send no content response (204)
 */
export const sendNoContent = (res: Response): Response => {
  logger.info('No content response: 204');
  return res.status(204).send();
};

/**
 * Send bad request response (400)
 */
export const sendBadRequest = (
  res: Response,
  message: string = "Bad request",
  errorCode: string = "VALIDATION_ERROR"
): Response => {
  return sendError(res, message, 400, errorCode);
};

/**
 * Send unauthorized response (401)
 */
export const sendUnauthorized = (
  res: Response,
  message: string = "Unauthorized access",
  errorCode: string = "UNAUTHORIZED"
): Response => {
  return sendError(res, message, 401, errorCode);
};

/**
 * Send forbidden response (403)
 */
export const sendForbidden = (
  res: Response,
  message: string = "Access forbidden",
  errorCode: string = "FORBIDDEN"
): Response => {
  return sendError(res, message, 403, errorCode);
};

/**
 * Send not found response (404)
 */
export const sendNotFound = (
  res: Response,
  message: string = "Resource not found",
  errorCode: string = "NOT_FOUND"
): Response => {
  return sendError(res, message, 404, errorCode);
};

/**
 * Send conflict response (409)
 */
export const sendConflict = (
  res: Response,
  message: string,
  errorCode: string = "CONFLICT"
): Response => {
  return sendError(res, message, 409, errorCode);
};

/**
 * Send internal error response (500)
 */
export const sendInternalError = (
  res: Response,
  message: string = "Internal server error",
  errorCode: string = "INTERNAL_ERROR"
): Response => {
  return sendError(res, message, 500, errorCode);
};

/**
 * Send service unavailable response (503)
 */
export const sendServiceUnavailable = (
  res: Response,
  message: string = "Service unavailable",
  errorCode: string = "SERVICE_UNAVAILABLE"
): Response => {
  return sendError(res, message, 503, errorCode);
};

/**
 * Parse pagination parameters from query
 */
export const parsePagination = (query: any): { page: number; limit: number } => {
  let page = parseInt(query.page) || 1;
  let limit = parseInt(query.limit) || 10;

  // Validate and constrain
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), 100); // Max 100 per page

  return { page, limit };
};

/**
 * Calculate pagination offset
 */
export const getPaginationOffset = (page: number, limit: number): number => {
  return (page - 1) * limit;
};

/**
 * Parse sort parameter from query
 */
export const parseSort = (
  sortQuery: string,
  allowedFields: string[]
): { field: string; order: 'ASC' | 'DESC' } | null => {
  if (!sortQuery) return null;

  const parts = sortQuery.split(':');
  const field = parts[0];

  if (!field || !allowedFields.includes(field)) {
    return null;
  }

  return {
    field,
    order: parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
  };
};

/**
 * Parse filter parameters from query
 */
export const parseFilters = (
  query: any,
  allowedFields: string[]
): Record<string, any> => {
  const filters: Record<string, any> = {};

  for (const field of allowedFields) {
    if (query[field] !== undefined && query[field] !== '') {
      filters[field] = query[field];
    }
  }

  return filters;
};

/**
 * Format response time in milliseconds
 */
export const formatResponseTime = (startTime: number): string => {
  const endTime = Date.now();
  const duration = endTime - startTime;
  return `${duration}ms`;
};

/**
 * Build query string from filters
 */
export const buildQueryString = (filters: Record<string, any>): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }

  return params.toString();
};
