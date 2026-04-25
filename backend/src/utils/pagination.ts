/**
 * Pagination Utilities
 * Helpers for paginating, filtering, and sorting data
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface FilterParams {
  [key: string]: any;
}

/**
 * Validate and normalize pagination parameters
 */
export const normalizePaginationParams = (params: PaginationParams) => {
  let page = Math.max(1, parseInt(String(params.page || 1), 10));
  let limit = Math.max(1, Math.min(100, parseInt(String(params.limit || 20), 10)));

  if (isNaN(page)) page = 1;
  if (isNaN(limit)) limit = 20;

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    sort: params.sort || 'created_at',
    order: (params.order || 'DESC').toUpperCase() as 'ASC' | 'DESC'
  };
};

/**
 * Build pagination SQL clause
 */
export const buildPaginationClause = (
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'ASC' | 'DESC' = 'DESC'
): string => {
  const offset = (page - 1) * limit;
  return `ORDER BY ${sort} ${order} LIMIT ${limit} OFFSET ${offset}`;
};

/**
 * Build filtering SQL WHERE clause
 */
export const buildFilterClause = (filters: FilterParams): string => {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      conditions.push(`${key} ILIKE '%${value}%'`);
    } else if (typeof value === 'number') {
      conditions.push(`${key} = ${value}`);
    } else if (typeof value === 'boolean') {
      conditions.push(`${key} = ${value}`);
    } else if (Array.isArray(value)) {
      const placeholders = value.map(() => '?').join(',');
      conditions.push(`${key} IN (${placeholders})`);
    }
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

/**
 * Create paginated response
 */
export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
};

/**
 * Get pagination metadata
 */
export const getPaginationMetadata = (total: number, page: number, limit: number) => {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPreviousPage: page > 1,
    startIndex: (page - 1) * limit + 1,
    endIndex: Math.min(page * limit, total)
  };
};

/**
 * Check if page is valid
 */
export const isValidPage = (page: number, totalPages: number): boolean => {
  return page > 0 && page <= totalPages;
};

/**
 * Calculate offset from page and limit
 */
export const calculateOffset = (page: number, limit: number): number => {
  return Math.max(0, (page - 1) * limit);
};

/**
 * Calculate total pages
 */
export const calculateTotalPages = (total: number, limit: number): number => {
  return Math.ceil(Math.max(0, total) / Math.max(1, limit));
};

/**
 * Paginate array in memory
 */
export const paginateArray = <T>(
  array: T[],
  page: number,
  limit: number
): { data: T[]; pagination: PaginatedResponse<T>['pagination'] } => {
  const offset = calculateOffset(page, limit);
  const data = array.slice(offset, offset + limit);

  return {
    data,
    pagination: getPaginationMetadata(array.length, page, limit) as PaginatedResponse<
      T
    >['pagination']
  };
};

/**
 * Filter array by multiple criteria
 */
export const filterArray = <T extends Record<string, any>>(
  array: T[],
  filters: FilterParams
): T[] => {
  return array.filter(item => {
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        if (!value.includes(item[key])) return false;
      } else if (typeof value === 'string') {
        if (!String(item[key]).toLowerCase().includes(value.toLowerCase())) return false;
      } else {
        if (item[key] !== value) return false;
      }
    }
    return true;
  });
};

/**
 * Sort array
 */
export const sortArray = <T extends Record<string, any>>(
  array: T[],
  sort: string,
  order: 'ASC' | 'DESC' = 'ASC'
): T[] => {
  const sorted = [...array];

  sorted.sort((a, b) => {
    const aVal = a[sort];
    const bVal = b[sort];

    if (aVal < bVal) return order === 'ASC' ? -1 : 1;
    if (aVal > bVal) return order === 'ASC' ? 1 : -1;
    return 0;
  });

  return sorted;
};

/**
 * Apply multiple filters and sorting to array
 */
export const queryArray = <T extends Record<string, any>>(
  array: T[],
  params: PaginationParams & FilterParams
): { data: T[]; pagination: PaginatedResponse<T>['pagination'] } => {
  const { page, limit, sort, order } = normalizePaginationParams(params);

  // Create filter object (exclude pagination params)
  const filterParams = Object.fromEntries(
    Object.entries(params).filter(
      ([key]) => !['page', 'limit', 'offset', 'sort', 'order'].includes(key)
    )
  );

  let filtered = filterArray(array, filterParams);
  const total = filtered.length;

  let sorted = sortArray(filtered, sort, order);
  const paginated = paginateArray(sorted, page, limit);

  return {
    data: paginated.data,
    pagination: {
      ...paginated.pagination,
      total
    }
  };
};

/**
 * Create SQL LIMIT clause
 */
export const sqlLimit = (limit: number): string => {
  const validLimit = Math.max(1, Math.min(1000, limit));
  return `LIMIT ${validLimit}`;
};

/**
 * Create SQL OFFSET clause
 */
export const sqlOffset = (offset: number): string => {
  const validOffset = Math.max(0, offset);
  return `OFFSET ${validOffset}`;
};

/**
 * Build complete query string from params
 */
export const buildQueryString = (params: PaginationParams & FilterParams): string => {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
};

/**
 * Get query parameters from URL string
 */
export const parseQueryString = (queryString: string): Record<string, string | string[]> => {
  const params: Record<string, string | string[]> = {};

  const searchParams = new URLSearchParams(queryString);
  for (const [key, value] of searchParams.entries()) {
    if (params[key]) {
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  }

  return params;
};
