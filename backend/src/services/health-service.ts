import { pool } from "../config/db";

export const getHealthStatus = async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      uptime: process.uptime()
    };
  } catch (error) {
    return {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};
