// src/routes/setup.routes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/jwt-auth";
import * as SetupController from "../controllers/setup.controller";

const router = Router();

/**
 * @route POST /setup/business
 * @description Setup business profile (requires authentication)
 * @auth Bearer token required
 * @body businessName, businessType, industry, website, country, phone
 */
router.post("/business", verifyToken, SetupController.setupBusiness);

/**
 * @route GET /setup/business
 * @description Get business profile (requires authentication)
 * @auth Bearer token required
 */
router.get("/business", verifyToken, SetupController.getProfile);

/**
 * @route GET /setup/status
 * @description Get onboarding status (requires authentication)
 * @auth Bearer token required
 */
router.get("/status", verifyToken, SetupController.getStatus);

export default router;
