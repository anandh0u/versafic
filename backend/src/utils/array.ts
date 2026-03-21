// src/utils/array.ts

/**
 * Remove duplicates from array
 */
export const removeDuplicates = <T>(arr: T[]): T[] => {
  return [...new Set(arr)];
};

/**
 * Remove duplicates by property
 */
export const removeDuplicatesByProperty = <T extends object, K extends keyof T>(
  arr: T[],
  key: K
): T[] => {
  const seen = new Set<T[K]>();
  return arr.filter(item => {
    if (seen.has(item[key])) {
      return false;
    }
    seen.add(item[key]);
    return true;
  });
};

/**
 * Find unique values
 */
export const getUnique = <T>(arr: T[]): T[] => {
  return removeDuplicates(arr);
};

/**
 * Flatten array
 */
export const flatten = <T>(arr: T[][]): T[] => {
  return arr.reduce((result, current) => result.concat(current), []);
};

/**
 * Chunk array into smaller arrays
 */
export const chunk = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

/**
 * Compact array (remove falsy values)
 */
export const compact = <T>(arr: (T | null | undefined | false | 0 | '')[]): T[] => {
  return arr.filter(Boolean) as T[];
};

/**
 * Shuffle array
 */
export const shuffle = <T>(arr: T[]): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    if (temp !== undefined) {
      const jVal = result[j];
      if (jVal !== undefined) {
        result[i] = jVal;
        result[j] = temp;
      }
    }
  }
  return result;
};

/**
 * Sample random elements from array
 */
export const sample = <T>(arr: T[], count: number = 1): T[] => {
  const shuffled = shuffle(arr);
  return shuffled.slice(0, Math.min(count, arr.length));
};

/**
 * Get random element from array
 */
export const random = <T>(arr: T[]): T | undefined => {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Find element by property
 */
export const findByProperty = <T extends object, K extends keyof T>(
  arr: T[],
  key: K,
  value: T[K]
): T | undefined => {
  return arr.find(item => item[key] === value);
};

/**
 * Filter by property
 */
export const filterByProperty = <T extends object, K extends keyof T>(
  arr: T[],
  key: K,
  value: T[K]
): T[] => {
  return arr.filter(item => item[key] === value);
};

/**
 * Map and filter
 */
export const filterMap = <T, U>(
  arr: T[],
  fn: (item: T) => U | null | undefined
): U[] => {
  return arr
    .map(fn)
    .filter((item): item is U => item !== null && item !== undefined);
};

/**
 * Sort by property
 */
export const sortByProperty = <T extends object, K extends keyof T>(
  arr: T[],
  key: K,
  order: 'asc' | 'desc' = 'asc'
): T[] => {
  const sorted = [...arr];
  sorted.sort((a, b) => {
    const aVal = String(a[key]);
    const bVal = String(b[key]);
    const comparison = aVal.localeCompare(bVal);
    return order === 'asc' ? comparison : -comparison;
  });
  return sorted;
};

/**
 * Sort by multiple properties
 */
export const sortByMultiple = <T extends object>(
  arr: T[],
  criteria: Array<{ key: keyof T; order?: 'asc' | 'desc' }>
): T[] => {
  const sorted = [...arr];
  sorted.sort((a, b) => {
    for (const { key, order = 'asc' } of criteria) {
      const aVal = String(a[key]);
      const bVal = String(b[key]);
      const comparison = aVal.localeCompare(bVal);
      if (comparison !== 0) {
        return order === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
  return sorted;
};

/**
 * Zip arrays together
 */
export const zip = <T>(...arrays: T[][]): T[][] => {
  const maxLength = Math.max(...arrays.map(arr => arr.length));
  const result: T[][] = [];

  for (let i = 0; i < maxLength; i++) {
    const group: T[] = [];
    for (const arr of arrays) {
      if (i < arr.length) {
        const val = arr[i];
        if (val !== undefined) {
          group.push(val);
        }
      }
    }
    if (group.length > 0) {
      result.push(group);
    }
  }

  return result;
};

/**
 * Unzip array
 */
export const unzip = <T>(arr: T[][]): T[][] => {
  if (arr.length === 0) return [];

  const result: T[][] = [];
  const maxLength = Math.max(...arr.map(subarr => subarr.length));

  for (let i = 0; i < maxLength; i++) {
    const group: T[] = [];
    for (const subarr of arr) {
      if (i < subarr.length) {
        const val = subarr[i];
        if (val !== undefined) {
          group.push(val);
        }
      }
    }
    if (group.length > 0) {
      result.push(group);
    }
  }

  return result;
};

/**
 * Check if array includes all elements
 */
export const includesAll = <T>(arr: T[], elements: T[]): boolean => {
  return elements.every(element => arr.includes(element));
};

/**
 * Check if array includes any elements
 */
export const includesAny = <T>(arr: T[], elements: T[]): boolean => {
  return elements.some(element => arr.includes(element));
};

/**
 * Get intersection of arrays
 */
export const intersection = <T>(...arrays: T[][]): T[] => {
  if (arrays.length === 0) return [];

  const first = arrays[0];
  if (!first) return [];
  
  return first.filter(item =>
    arrays.slice(1).every(arr => arr.includes(item))
  );
};

/**
 * Get union of arrays
 */
export const union = <T>(...arrays: T[][]): T[] => {
  return removeDuplicates(arrays.flat());
};

/**
 * Get difference between arrays
 */
export const difference = <T>(arr1: T[], arr2: T[]): T[] => {
  return arr1.filter(item => !arr2.includes(item));
};

/**
 * Get symmetric difference
 */
export const symmetricDifference = <T>(arr1: T[], arr2: T[]): T[] => {
  const diff1 = difference(arr1, arr2);
  const diff2 = difference(arr2, arr1);
  return union(diff1, diff2);
};

/**
 * Paginate array
 */
export const paginate = <T>(
  arr: T[],
  page: number,
  pageSize: number
): { items: T[]; page: number; pageSize: number; total: number; pages: number } => {
  const total = arr.length;
  const pages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: arr.slice(start, end),
    page,
    pageSize,
    total,
    pages
  };
};

/**
 * Transpose matrix (array of arrays)
 */
export const transpose = <T>(matrix: T[][]): T[][] => {
  if (matrix.length === 0 || !matrix[0]) return [];

  const cols = matrix[0].length;
  const result: T[][] = [];

  for (let i = 0; i < cols; i++) {
    const col: T[] = [];
    for (const row of matrix) {
      if (i < row.length) {
        const val = row[i];
        if (val !== undefined) {
          col.push(val);
        }
      }
    }
    if (col.length > 0) {
      result.push(col);
    }
  }

  return result;
};

/**
 * Partition array by condition
 */
export const partition = <T>(
  arr: T[],
  predicate: (item: T) => boolean
): [T[], T[]] => {
  const pass: T[] = [];
  const fail: T[] = [];

  arr.forEach(item => {
    (predicate(item) ? pass : fail).push(item);
  });

  return [pass, fail];
};

/**
 * First element
 */
export const first = <T>(arr: T[]): T | undefined => {
  return arr[0];
};

/**
 * Last element
 */
export const last = <T>(arr: T[]): T | undefined => {
  return arr[arr.length - 1];
};

/**
 * Nth element
 */
export const nth = <T>(arr: T[], n: number): T | undefined => {
  const index = n < 0 ? arr.length + n : n;
  return arr[index];
};

/**
 * Take first n elements
 */
export const take = <T>(arr: T[], n: number): T[] => {
  return arr.slice(0, Math.max(0, n));
};

/**
 * Drop first n elements
 */
export const drop = <T>(arr: T[], n: number): T[] => {
  return arr.slice(Math.max(0, n));
};

/**
 * Rotate array
 */
export const rotate = <T>(arr: T[], n: number): T[] => {
  const rotations = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(-rotations), ...arr.slice(0, arr.length - rotations)];
};
