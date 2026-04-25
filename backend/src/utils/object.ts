// src/utils/object.ts

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (obj instanceof Object) {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
};

/**
 * Merge objects (shallow)
 */
export const merge = <T extends object>(target: T, source: Partial<T>): T => {
  return { ...target, ...source };
};

/**
 * Deep merge objects
 */
export const deepMerge = <T extends object>(target: T, source: Partial<T>): T => {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue as any, sourceValue as any);
      } else {
        result[key] = sourceValue as any;
      }
    }
  }

  return result;
};

/**
 * Pick specific keys from object
 */
export const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

/**
 * Omit specific keys from object
 */
export const omit = <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach(key => {
    delete (result as any)[key];
  });
  return result as Omit<T, K>;
};

/**
 * Get nested property from object
 */
export const getNestedProperty = (obj: any, path: string): any => {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
};

/**
 * Set nested property in object
 */
export const setNestedProperty = (obj: any, path: string, value: any): void => {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key && typeof key === 'string' && !(key in current)) {
      current[key] = {};
    }
    if (key && typeof key === 'string') {
      current = current[key];
    }
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey && typeof lastKey === 'string') {
    current[lastKey] = value;
  }
};

/**
 * Check if object is empty
 */
export const isEmpty = (obj: any): boolean => {
  if (typeof obj !== 'object' || obj === null) return true;
  return Object.keys(obj).length === 0;
};

/**
 * Check if object has property
 */
export const hasProperty = <T extends object>(obj: T, key: PropertyKey): key is keyof T => {
  return key in obj;
};

/**
 * Get object keys with type safety
 */
export const getKeys = <T extends object>(obj: T): (keyof T)[] => {
  return Object.keys(obj) as (keyof T)[];
};

/**
 * Get object values
 */
export const getValues = <T extends object>(obj: T): T[keyof T][] => {
  return Object.values(obj);
};

/**
 * Get object entries
 */
export const getEntries = <T extends object>(obj: T): [keyof T, T[keyof T]][] => {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
};

/**
 * Transform object keys
 */
export const mapKeys = <T extends object>(
  obj: T,
  fn: (key: keyof T) => string
): Record<string, T[keyof T]> => {
  const result: Record<string, T[keyof T]> = {};
  getEntries(obj).forEach(([key, value]) => {
    result[fn(key)] = value;
  });
  return result;
};

/**
 * Transform object values
 */
export const mapValues = <T extends object, U>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => U
): Record<keyof T, U> => {
  const result = {} as Record<keyof T, U>;
  getEntries(obj).forEach(([key, value]) => {
    result[key] = fn(value, key);
  });
  return result;
};

/**
 * Filter object by keys
 */
export const filterKeys = <T extends object>(
  obj: T,
  predicate: (key: keyof T) => boolean
): Partial<T> => {
  const result: Partial<T> = {};
  getEntries(obj).forEach(([key, value]) => {
    if (predicate(key)) {
      result[key] = value;
    }
  });
  return result;
};

/**
 * Filter object by values
 */
export const filterValues = <T extends object>(
  obj: T,
  predicate: (value: T[keyof T]) => boolean
): Partial<T> => {
  const result: Partial<T> = {};
  getEntries(obj).forEach(([key, value]) => {
    if (predicate(value)) {
      result[key] = value;
    }
  });
  return result;
};

/**
 * Flatten nested object
 */
export const flattenObject = (obj: any, prefix: string = ''): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
  }

  return result;
};

/**
 * Unflatten object
 */
export const unflattenObject = (obj: Record<string, any>): any => {
  const result: any = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      setNestedProperty(result, key, obj[key]);
    }
  }

  return result;
};

/**
 * Convert object to query string
 */
export const objectToQueryString = (obj: Record<string, any>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      params.append(key, String(value));
    }
  }
  return params.toString();
};

/**
 * Convert query string to object
 */
export const queryStringToObject = (queryString: string): Record<string, string> => {
  const obj: Record<string, string> = {};
  const params = new URLSearchParams(queryString);
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
};

/**
 * Sort object by keys
 */
export const sortByKeys = <T extends object>(obj: T): Record<string, T[keyof T]> => {
  const sorted: Record<string, T[keyof T]> = {};
  Object.keys(obj)
    .sort()
    .forEach(key => {
      sorted[key] = obj[key as keyof T];
    });
  return sorted;
};

/**
 * Sort object by values
 */
export const sortByValues = <T extends object>(
  obj: T,
  order: 'asc' | 'desc' = 'asc'
): [string, T[keyof T]][] => {
  const entries = Object.entries(obj) as [string, T[keyof T]][];
  return entries.sort(([, a], [, b]) => {
    if (order === 'asc') {
      return String(a).localeCompare(String(b));
    } else {
      return String(b).localeCompare(String(a));
    }
  });
};

/**
 * Group array of objects by key
 */
export const groupBy = <T extends object, K extends keyof T>(
  arr: T[],
  key: K
): Record<string, T[]> => {
  return arr.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

/**
 * Index array of objects by key
 */
export const indexBy = <T extends object, K extends keyof T>(
  arr: T[],
  key: K
): Record<string, T> => {
  return arr.reduce((result, item) => {
    result[String(item[key])] = item;
    return result;
  }, {} as Record<string, T>);
};
