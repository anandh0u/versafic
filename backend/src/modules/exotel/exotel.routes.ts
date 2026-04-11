import { Router } from "express";
import { verifyToken } from "../../middleware/jwt-auth";
import {
  getExotelConfig,
  handleExotelIncoming,
  handleExotelRecording,
  handleExotelStatus,
  startExotelCall,
} from "./exotel.controller";

const router = Router();

router.get("/exotel/config", getExotelConfig);
router.post("/call/start", verifyToken, startExotelCall);
router.post("/internal/call/start", startExotelCall);
router.route("/exotel/incoming").get(handleExotelIncoming).post(handleExotelIncoming);
router.route("/exotel/recording").get(handleExotelRecording).post(handleExotelRecording);
router.post("/exotel/status", handleExotelStatus);

export default router;
