import { Request, Response } from "express";
import { pool } from "../config/database";
import { logger } from "../utils/logger";
import {
  getPhoneValidationError,
  getRegistrableEmailError,
  hasSQLInjectionPatterns,
  hasXSSPatterns,
  isValidEmail,
  normalizePhoneNumber,
  sanitizeEmail,
} from "../utils/validators";

export interface OnboardingData {
  business_name: string;
  business_type: string;
  owner_name: string;
  phone: string;
  email: string;
}

export class BusinessController {
  private static tableInitializationPromise: Promise<void> | null = null;

  /**
   * Onboard a business
   * POST /business/onboard
   */
  static async onboard(req: Request, res: Response): Promise<void> {
    try {
      const { business_name, business_type, owner_name, phone, email } = req.body;

      // Validation
      if (!business_name || !business_type || !owner_name || !phone || !email) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "All fields are required: business_name, business_type, owner_name, phone, email"
        });
        return;
      }

      // Input sanitization and security checks
      if (typeof business_name !== 'string' || typeof business_type !== 'string' || 
          typeof owner_name !== 'string' || typeof phone !== 'string' || typeof email !== 'string') {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "All fields must be strings"
        });
        return;
      }

      // Check for injection attacks
      if (hasXSSPatterns(business_name) || hasXSSPatterns(owner_name)) {
        logger.warn("XSS pattern detected in business onboarding", { business_name, owner_name });
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Invalid characters in input"
        });
        return;
      }

      if (hasSQLInjectionPatterns(business_name) || hasSQLInjectionPatterns(owner_name)) {
        logger.warn("SQL injection pattern detected in business onboarding", { business_name, owner_name });
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Invalid input format"
        });
        return;
      }

      // Validate email and phone
      const normalizedEmail = sanitizeEmail(email);
      const emailValidationError = await getRegistrableEmailError(normalizedEmail);
      if (emailValidationError) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: emailValidationError
        });
        return;
      }

      const phoneValidationError = getPhoneValidationError(phone);
      if (phoneValidationError) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: phoneValidationError
        });
        return;
      }

      logger.info("Processing business onboarding", { business_name, email: normalizedEmail });

      // Create table if not exists
      await this.initializeTable();

      // Insert business data
      const query = `
        INSERT INTO businesses (
          business_name,
          business_type,
          owner_name,
          phone,
          email
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at;
      `;

      const result = await pool.query(query, [
        business_name,
        business_type,
        owner_name,
        normalizePhoneNumber(phone),
        normalizedEmail
      ]);

      if (!result.rows || result.rows.length === 0) {
        res.status(500).json({
          status: "error",
          statusCode: 500,
          message: "Failed to create business record"
        });
        return;
      }

      const businessId = result.rows[0].id;
      const createdAt = result.rows[0].created_at;

      logger.info("Business onboarded successfully", {
        id: businessId,
        name: business_name
      });

      res.status(201).json({
        status: "success",
        statusCode: 201,
        message: "Business onboarded successfully",
        data: {
          id: businessId,
          business_name,
          email: normalizedEmail,
          created_at: createdAt
        }
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorCode = (error as { code?: string } | undefined)?.code;
      if (errorCode === "23505") {
        res.status(409).json({
          status: "error",
          statusCode: 409,
          message: "Business with this email already exists"
        });
        return;
      }
      logger.error("Business onboarding error", err);
      res.status(500).json({
        status: "error",
        statusCode: 500,
        message: "Failed to onboard business"
      });
    }
  }

  /**
   * Get business by email
   * GET /business/:email
   */
  static async getByEmail(req: Request, res: Response): Promise<void> {
    try {
      const email = Array.isArray(req.params.email) ? req.params.email[0] : req.params.email;
      await this.initializeTable();

      if (!email) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Email is required"
        });
        return;
      }

      const normalizedEmail = sanitizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Invalid email address"
        });
        return;
      }

      logger.info("Retrieving business", { email: normalizedEmail });

      const query = `
        SELECT * FROM businesses
        WHERE email = $1
        LIMIT 1;
      `;

      const result = await pool.query(query, [normalizedEmail]);

      if (result.rows.length === 0) {
        res.status(404).json({
          status: "error",
          statusCode: 404,
          message: "Business not found"
        });
        return;
      }

      res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result.rows[0]
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error retrieving business", err);
      res.status(500).json({
        status: "error",
        statusCode: 500,
        message: "Failed to retrieve business"
      });
    }
  }

  /**
   * Get all businesses
   * GET /business/list
   */
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      await this.initializeTable();

      logger.info("Retrieving businesses list", { limit, offset });

      const query = `
        SELECT * FROM businesses
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2;
      `;

      const result = await pool.query(query, [limit, offset]);

      res.status(200).json({
        status: "success",
        statusCode: 200,
        data: result.rows,
        pagination: {
          limit,
          offset,
          count: result.rows.length
        }
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error retrieving businesses", err);
      res.status(500).json({
        status: "error",
        statusCode: 500,
        message: "Failed to retrieve businesses"
      });
    }
  }

  /**
   * Update business
   * PUT /business/:id
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { business_name, business_type, owner_name, phone, email } = req.body;
      await this.initializeTable();

      if (!id) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Business ID is required"
        });
        return;
      }

      // Validate provided fields for injection attacks
      if (business_name && (hasXSSPatterns(business_name) || hasSQLInjectionPatterns(business_name))) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Invalid characters in business_name"
        });
        return;
      }

      if (owner_name && (hasXSSPatterns(owner_name) || hasSQLInjectionPatterns(owner_name))) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: "Invalid characters in owner_name"
        });
        return;
      }

      const normalizedEmail = typeof email === "string" ? sanitizeEmail(email) : "";
      if (normalizedEmail) {
        const emailValidationError = await getRegistrableEmailError(normalizedEmail);
        if (emailValidationError) {
          res.status(400).json({
            status: "error",
            statusCode: 400,
            message: emailValidationError
          });
          return;
        }
      }

      const phoneValidationError =
        typeof phone === "string" && phone.trim() ? getPhoneValidationError(phone) : null;
      if (phoneValidationError) {
        res.status(400).json({
          status: "error",
          statusCode: 400,
          message: phoneValidationError
        });
        return;
      }

      logger.info("Updating business", { id });

      const query = `
        UPDATE businesses
        SET
          business_name = COALESCE($2, business_name),
          business_type = COALESCE($3, business_type),
          owner_name = COALESCE($4, owner_name),
          phone = COALESCE($5, phone),
          email = COALESCE($6, email),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;

      const result = await pool.query(query, [
        id,
        business_name || null,
        business_type || null,
        owner_name || null,
        phone ? normalizePhoneNumber(phone) : null,
        normalizedEmail || null
      ]);

      if (result.rows.length === 0) {
        res.status(404).json({
          status: "error",
          statusCode: 404,
          message: "Business not found"
        });
        return;
      }

      res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Business updated successfully",
        data: result.rows[0]
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error updating business", err);
      res.status(500).json({
        status: "error",
        statusCode: 500,
        message: "Failed to update business"
      });
    }
  }

  /**
   * Initialize businesses table
   */
  private static async initializeTable(): Promise<void> {
    if (!this.tableInitializationPromise) {
      this.tableInitializationPromise = (async () => {
        try {
          const createTableQuery = `
            CREATE TABLE IF NOT EXISTS businesses (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              business_name VARCHAR(255) NOT NULL,
              business_type VARCHAR(100) NOT NULL,
              owner_name VARCHAR(255) NOT NULL,
              phone VARCHAR(20) NOT NULL,
              email VARCHAR(255) NOT NULL UNIQUE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(email);
            CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at);
          `;

          const statements = createTableQuery
            .split(";")
            .filter((stmt) => stmt.trim());

          for (const statement of statements) {
            await pool.query(statement);
          }

          logger.debug("Businesses table initialized");
        } catch (error) {
          this.tableInitializationPromise = null;
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          logger.warn("Failed to initialize businesses table", { error: errorMsg });
        }
      })();
    }

    await this.tableInitializationPromise;
  }
}
