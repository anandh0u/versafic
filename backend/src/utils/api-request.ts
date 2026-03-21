/**
 * API Request/Response Utilities
 * Helpers for HTTP operations, request building, and API interactions
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
  error?: string;
}

/**
 * Build query parameters from object
 */
export const buildQueryParams = (params: Record<string, any>): string => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map(v => `${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`).join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join('&');

  return entries ? `?${entries}` : '';
};

/**
 * Build URL with query parameters
 */
export const buildUrl = (baseUrl: string, params?: Record<string, any>): string => {
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }

  return baseUrl + buildQueryParams(params);
};

/**
 * Parse URL to get components
 */
export const parseUrl = (url: string) => {
  const urlObj = new URL(url);

  return {
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    port: urlObj.port,
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
    origin: urlObj.origin,
    href: urlObj.href
  };
};

/**
 * Validate URL
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
export const getDomain = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
};

/**
 * Get path from URL
 */
export const getPathFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return null;
  }
};

/**
 * Add query parameter to URL
 */
export const addQueryParam = (url: string, key: string, value: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

/**
 * Remove query parameter from URL
 */
export const removeQueryParam = (url: string, key: string): string => {
  const urlObj = new URL(url);
  urlObj.searchParams.delete(key);
  return urlObj.toString();
};

/**
 * Get query parameter value
 */
export const getQueryParam = (url: string, key: string): string | null => {
  const urlObj = new URL(url);
  return urlObj.searchParams.get(key);
};

/**
 * Get all query parameters as object
 */
export const getAllQueryParams = (url: string): Record<string, string> => {
  const urlObj = new URL(url);
  const params: Record<string, string> = {};

  for (const [key, value] of urlObj.searchParams.entries()) {
    params[key] = value;
  }

  return params;
};

/**
 * Create form data from object
 */
export const createFormData = (data: Record<string, any>): FormData => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v, index) => {
          formData.append(`${key}[]`, String(v));
        });
      } else {
        formData.append(key, String(value));
      }
    }
  }

  return formData;
};

/**
 * Create multipart request body
 */
export const createMultipartBody = (data: Record<string, any>, boundary: string): string => {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Disposition: form-data; name="${key}"`);
      lines.push('');
      lines.push(String(value));
    }
  }

  lines.push(`--${boundary}--`);
  return lines.join('\r\n');
};

/**
 * Serialize request body based on content type
 */
export const serializeBody = (data: any, contentType: string = 'application/json'): string => {
  if (contentType.includes('json')) {
    return JSON.stringify(data);
  } else if (contentType.includes('form-urlencoded')) {
    return buildQueryParams(data).substring(1); // Remove leading ?
  } else if (contentType.includes('xml')) {
    return objectToXml(data);
  }

  return String(data);
};

/**
 * Convert object to XML string
 */
export const objectToXml = (obj: any, rootName: string = 'root'): string => {
  const lines: string[] = [`<?xml version="1.0" encoding="UTF-8"?>`];
  lines.push(`<${rootName}>`);

  const processValue = (key: string, value: any, depth: number) => {
    const indent = '  '.repeat(depth);

    if (value === null || value === undefined) {
      lines.push(`${indent}<${key} />`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${indent}<${key}>`);
      for (const [k, v] of Object.entries(value)) {
        processValue(k, v, depth + 1);
      }
      lines.push(`${indent}</${key}>`);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        processValue(key, item, depth);
      }
    } else {
      lines.push(`${indent}<${key}>${escapeXml(String(value))}</${key}>`);
    }
  };

  for (const [key, value] of Object.entries(obj)) {
    processValue(key, value, 1);
  }

  lines.push(`</${rootName}>`);
  return lines.join('\n');
};

/**
 * Escape XML special characters
 */
export const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Extract headers from response
 */
export const extractHeaders = (headerString: string): Record<string, string> => {
  const headers: Record<string, string> = {};

  const lines = headerString.split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      headers[key.trim()] = valueParts.join(':').trim();
    }
  }

  return headers;
};

/**
 * Create authorization header
 */
export const createAuthHeader = (
  type: 'Bearer' | 'Basic' | 'ApiKey',
  token: string
): Record<string, string> => {
  if (type === 'Bearer') {
    return { Authorization: `Bearer ${token}` };
  } else if (type === 'Basic') {
    return { Authorization: `Basic ${token}` };
  } else {
    return { 'X-API-Key': token };
  }
};

/**
 * Encode Basic Auth credentials
 */
export const encodeBasicAuth = (username: string, password: string): string => {
  return Buffer.from(`${username}:${password}`).toString('base64');
};

/**
 * Create request with retries
 */
export const createRetryRequest = async (
  fn: () => Promise<any>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<any> => {
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

  throw lastError;
};

/**
 * Check if response is successful
 */
export const isSuccessfulResponse = (status: number): boolean => {
  return status >= 200 && status < 300;
};

/**
 * Check if response is redirect
 */
export const isRedirectResponse = (status: number): boolean => {
  return status >= 300 && status < 400;
};

/**
 * Check if response is client error
 */
export const isClientError = (status: number): boolean => {
  return status >= 400 && status < 500;
};

/**
 * Check if response is server error
 */
export const isServerError = (status: number): boolean => {
  return status >= 500 && status < 600;
};

/**
 * Get HTTP status message
 */
export const getStatusMessage = (status: number): string => {
  const messages: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    503: 'Service Unavailable'
  };

  return messages[status] || 'Unknown Status';
};

/**
 * Sanitize URL (remove sensitive parts)
 */
export const sanitizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const urlStr = urlObj.toString();

    return urlStr.replace(/(\?|&)([a-z_]+)=([^&]*)/gi, (match, sep, key, value) => {
      if (['password', 'token', 'secret', 'key', 'api', 'auth'].some(w => key.toLowerCase().includes(w))) {
        return `${sep}${key}=***`;
      }
      return match;
    });
  } catch {
    return url;
  }
};
