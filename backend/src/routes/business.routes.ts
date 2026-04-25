import { Router, Request, Response } from "express";
import { BusinessController } from "../controllers/business.controller";
import { logger } from "../utils/logger";

const router = Router();

/**
 * POST /business/onboard
 * Onboard a new business
 * Required fields: business_name, business_type, owner_name, phone, email
 */
router.post("/onboard", async (req: Request, res: Response) => {
  try {
    await BusinessController.onboard(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Business onboard route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * GET /business/:email
 * Get business by email
 */
router.get("/:email", async (req: Request, res: Response) => {
  try {
    await BusinessController.getByEmail(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Business get route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * GET /business
 * Get all businesses with pagination
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    await BusinessController.getAll(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Business list route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**
 * PUT /business/:id
 * Update business information
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    await BusinessController.update(req, res);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Business update route error", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

export default router;
