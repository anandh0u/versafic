// src/controllers/setup.controller.ts
import { NextFunction, Response } from "express";
import { AuthRequest } from "../middleware/jwt-auth";
import * as SetupService from "../services/setup.service";
import { AppError } from "../middleware/error-handler";
import { ErrorCode } from "../types";

export const setupBusiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, "User not authenticated"));
    }

    const { businessName, businessType, industry, website, country, phone } = req.body;

    if (!businessName) {
      return next(new AppError(400, ErrorCode.VALIDATION_ERROR, "Business name is required"));
    }

    const profile = await SetupService.setupBusinessProfile(req.user.id, {
      businessName,
      businessType,
      industry,
      website,
      country,
      phone
    });

    res.status(201).json({
      status: "success",
      message: "Business profile setup completed",
      data: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, "User not authenticated"));
    }

    const profile = await SetupService.getBusinessProfile(req.user.id);

    res.status(200).json({
      status: "success",
      message: "Business profile retrieved",
      data: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const getStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCode.UNAUTHORIZED, "User not authenticated"));
    }

    const status = await SetupService.getOnboardingStatus(req.user.id);

    res.status(200).json({
      status: "success",
      message: "Onboarding status retrieved",
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};
