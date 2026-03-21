/**
 * File System Utilities
 * Helpers for file operations, path handling, and file system tasks
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

/**
 * Read file as UTF-8 string
 */
export const readFileAsync = promisify(fs.readFile) as (
  path: string,
  encoding: BufferEncoding
) => Promise<string>;

/**
 * Write content to file
 */
export const writeFileAsync = promisify(fs.writeFile) as (
  path: string,
  data: string | Buffer
) => Promise<void>;

/**
 * Delete file
 */
export const deleteFileAsync = promisify(fs.unlink) as (path: string) => Promise<void>;

/**
 * Check if file exists
 */
export const fileExists = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

/**
 * Create directory recursively
 */
export const createDirectoryAsync = promisify(fs.mkdir) as (
  path: string,
  options?: { recursive?: boolean }
) => Promise<string | undefined>;

/**
 * Read directory contents
 */
export const readDirectoryAsync = promisify(fs.readdir) as (path: string) => Promise<string[]>;

/**
 * Get file stats (size, modified time, etc)
 */
export const getFileStatsAsync = promisify(fs.stat) as (path: string) => Promise<fs.Stats>;

/**
 * Get file size in bytes
 */
export const getFileSizeAsync = async (filePath: string): Promise<number> => {
  const stats = await getFileStatsAsync(filePath);
  return stats.size;
};

/**
 * Get file size in human readable format
 */
export const getFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Copy file from source to destination
 */
export const copyFileAsync = promisify(fs.copyFile) as (
  source: string,
  destination: string
) => Promise<void>;

/**
 * Rename/move file
 */
export const renameFileAsync = promisify(fs.rename) as (
  oldPath: string,
  newPath: string
) => Promise<void>;

/**
 * Get file extension
 */
export const getFileExtension = (filePath: string): string => {
  return path.extname(filePath).toLowerCase();
};

/**
 * Get file name without extension
 */
export const getFileNameWithoutExtension = (filePath: string): string => {
  return path.parse(filePath).name;
};

/**
 * Get absolute path
 */
export const getAbsolutePath = (filePath: string): string => {
  return path.resolve(filePath);
};

/**
 * Join path segments
 */
export const joinPath = (...segments: string[]): string => {
  return path.join(...segments);
};

/**
 * Get directory name from path
 */
export const getDirectoryName = (filePath: string): string => {
  return path.dirname(filePath);
};

/**
 * Check if path is absolute
 */
export const isAbsolutePath = (filePath: string): boolean => {
  return path.isAbsolute(filePath);
};

/**
 * Get relative path between two paths
 */
export const getRelativePath = (from: string, to: string): string => {
  return path.relative(from, to);
};

/**
 * Check if file is readable
 */
export const isFileReadable = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if file is writable
 */
export const isFileWritable = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Watch file for changes
 */
export const watchFile = (
  filePath: string,
  callback: (curr: fs.Stats, prev: fs.Stats) => void
): void => {
  fs.watchFile(filePath, callback);
};

/**
 * Read JSON file
 */
export const readJsonFileAsync = async <T = any>(filePath: string): Promise<T> => {
  const content = await readFileAsync(filePath, 'utf-8');
  return JSON.parse(content);
};

/**
 * Write JSON file
 */
export const writeJsonFileAsync = async (filePath: string, data: any): Promise<void> => {
  const jsonString = JSON.stringify(data, null, 2);
  await writeFileAsync(filePath, jsonString);
};

/**
 * Create temporary file
 */
export const createTempFileAsync = async (content: string): Promise<string> => {
  const tempPath = path.join('/tmp', `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  await writeFileAsync(tempPath, content);
  return tempPath;
};

/**
 * Clean up directory by removing all files
 */
export const cleanDirectoryAsync = async (dirPath: string): Promise<void> => {
  const files = await readDirectoryAsync(dirPath);
  for (const file of files) {
    await deleteFileAsync(path.join(dirPath, file));
  }
};

/**
 * List files in directory recursively
 */
export const listFilesRecursiveAsync = async (dirPath: string): Promise<string[]> => {
  const files: string[] = [];
  const entries = await readDirectoryAsync(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stats = await getFileStatsAsync(fullPath);

    if (stats.isDirectory()) {
      const subFiles = await listFilesRecursiveAsync(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
};

/**
 * Backup file by creating a copy with timestamp
 */
export const backupFileAsync = async (filePath: string): Promise<string> => {
  const dir = getDirectoryName(filePath);
  const name = getFileNameWithoutExtension(filePath);
  const ext = getFileExtension(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const backupPath = path.join(dir, `${name}-backup-${timestamp}${ext}`);

  await copyFileAsync(filePath, backupPath);
  return backupPath;
};
