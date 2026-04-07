// src/services/setup.service.ts
import { AppError } from "../middleware/error-handler";
import { ErrorCode } from "../types";
import * as OnboardingModel from "../models/onboarding.model";
import * as UserModel from "../models/user.model";
import { logger } from "../utils/logger";
import { normalizePhoneNumber } from "../utils/validators";

export interface SetupBusinessProfileInput {
  businessName: string;
  businessType?: string;
  industry?: string;
  website?: string;
  country?: string;
  phone?: string;
}

export const setupBusinessProfile = async (
  userId: string | number,
  profileData: SetupBusinessProfileInput
): Promise<any> => {
  try {
    // Check if user exists
    const user = await UserModel.findUserById(userId);
    if (!user) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND, "User not found");
    }

    // Check if business profile exists
    const existingProfile = await OnboardingModel.findBusinessByUserId(userId);

    let profile;
    const normalizedPhone = profileData.phone?.trim() ? normalizePhoneNumber(profileData.phone) : undefined;
    if (existingProfile) {
      // Update existing profile
      profile = await OnboardingModel.updateBusinessProfile(
        userId,
        profileData.businessName,
        profileData.businessType,
        profileData.industry,
        profileData.website,
        profileData.country,
        normalizedPhone
      );
      logger.info("Business profile updated", { userId, businessName: profileData.businessName });
    } else {
      // Create new profile
      profile = await OnboardingModel.createBusinessProfile(
        userId,
        profileData.businessName,
        profileData.businessType,
        profileData.industry,
        profileData.website,
        profileData.country,
        normalizedPhone
      );
      logger.info("Business profile created", { userId, businessName: profileData.businessName });
    }

    // Update user onboarding status
    await UserModel.updateUserOnboardingStatus(userId, true);

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error setting up business profile", error instanceof Error ? error : new Error(String(error)));
    throw new AppError(500, ErrorCode.SETUP_ERROR, "Failed to complete business setup");
  }
};

export const getBusinessProfile = async (userId: string | number): Promise<any> => {
  try {
    const profile = await OnboardingModel.findBusinessByUserId(userId);
    if (!profile) {
      throw new AppError(404, ErrorCode.PROFILE_NOT_FOUND, "Business profile not found");
    }
    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error getting business profile", error instanceof Error ? error : new Error(String(error)));
    throw new AppError(500, ErrorCode.GET_PROFILE_ERROR, "Failed to retrieve business profile");
  }
};

export const getOnboardingStatus = async (userId: string | number): Promise<any> => {
  try {
    const user = await UserModel.findUserById(userId);
    if (!user) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND, "User not found");
    }

    const profile = await OnboardingModel.findBusinessByUserId(userId);

    return {
      isOnboarded: user.is_onboarded,
      hasBusinessProfile: !!profile,
      profile: profile || null
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Error getting onboarding status", error instanceof Error ? error : new Error(String(error)));
    throw new AppError(500, ErrorCode.STATUS_ERROR, "Failed to retrieve onboarding status");
  }
};
