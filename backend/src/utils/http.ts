// src/utils/http.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { logger } from './logger';

/**
 * Create HTTP client instance with custom config
 */
export const createHttpClient = (config?: AxiosRequestConfig): AxiosInstance => {
  return axios.create({
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Versafic/1.0'
    },
    ...config
  });
};

/**
 * Make GET request
 */
export const httpGet = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const client = createHttpClient();
    const response = await client.get<T>(url, config);
    logger.info(`GET ${url}`, { status: response.status });
    return { success: true, data: response.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`GET ${url} failed:`, error as Error);
    return { success: false, error: message };
  }
};

/**
 * Make POST request
 */
export const httpPost = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const client = createHttpClient();
    const response = await client.post<T>(url, data, config);
    logger.info(`POST ${url}`, { status: response.status });
    return { success: true, data: response.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`POST ${url} failed:`, error as Error);
    return { success: false, error: message };
  }
};

/**
 * Make PUT request
 */
export const httpPut = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const client = createHttpClient();
    const response = await client.put<T>(url, data, config);
    logger.info(`PUT ${url}`, { status: response.status });
    return { success: true, data: response.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`PUT ${url} failed:`, error as Error);
    return { success: false, error: message };
  }
};

/**
 * Make DELETE request
 */
export const httpDelete = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const client = createHttpClient();
    const response = await client.delete<T>(url, config);
    logger.info(`DELETE ${url}`, { status: response.status });
    return { success: true, data: response.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`DELETE ${url} failed:`, error as Error);
    return { success: false, error: message };
  }
};

/**
 * Make PATCH request
 */
export const httpPatch = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const client = createHttpClient();
    const response = await client.patch<T>(url, data, config);
    logger.info(`PATCH ${url}`, { status: response.status });
    return { success: true, data: response.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`PATCH ${url} failed:`, error as Error);
    return { success: false, error: message };
  }
};

/**
 * Build query parameters from object
 */
export const buildQueryParams = (params: Record<string, any>): string => {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      queryParams.append(key, String(value));
    }
  }

  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
};

/**
 * Parse query parameters from URL
 */
export const parseQueryParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const urlObj = new URL(url, 'http://localhost');

  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
};

/**
 * Build complete URL with query params
 */
export const buildUrl = (baseUrl: string, path: string, params?: Record<string, any>): string => {
  let url = `${baseUrl}${path}`;
  if (params) {
    const queryString = buildQueryParams(params);
    url += queryString;
  }
  return url;
};

/**
 * Check if URL is valid
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get domain from URL
 */
export const getDomainFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
};

/**
 * Get query param value from URL
 */
export const getQueryParam = (url: string, param: string): string | null => {
  try {
    const urlObj = new URL(url, 'http://localhost');
    return urlObj.searchParams.get(param);
  } catch {
    return null;
  }
};

/**
 * Add header to request config
 */
export const addHeader = (
  config: AxiosRequestConfig,
  key: string,
  value: string
): AxiosRequestConfig => {
  return {
    ...config,
    headers: {
      ...config?.headers,
      [key]: value
    }
  };
};

/**
 * Add bearer token to request
 */
export const addBearerToken = (
  config: AxiosRequestConfig,
  token: string
): AxiosRequestConfig => {
  return addHeader(config, 'Authorization', `Bearer ${token}`);
};

/**
 * Add API key to request
 */
export const addApiKey = (
  config: AxiosRequestConfig,
  key: string,
  headerName: string = 'X-API-Key'
): AxiosRequestConfig => {
  return addHeader(config, headerName, key);
};

/**
 * Retry failed request
 */
export const retryRequest = async <T = any>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
};

/**
 * Timeout promise
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

/**
 * Build Authorization header
 */
export const buildAuthHeader = (type: 'Bearer' | 'Basic', token: string): string => {
  return `${type} ${token}`;
};

/**
 * Parse Authorization header
 */
export const parseAuthHeader = (header: string): { type: string; token: string } | null => {
  const parts = header.split(' ');
  if (parts.length !== 2) return null;

  const type = parts[0];
  const token = parts[1];

  if (!type || !token) return null;

  return { type, token };
};
