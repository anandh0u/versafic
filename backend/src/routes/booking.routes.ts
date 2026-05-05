import { Router, Response, NextFunction } from "express";
import { verifyToken, type AuthRequest } from "../middleware/jwt-auth";
import { bookingService, type BookingStatus } from "../services/booking.service";
import { sendSuccess, sendCreated, sendBadRequest } from "../utils/response";

const router = Router();

const getUserId = (req: AuthRequest): number | null => {
  const userId = Number(req.user?.id);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
};

router.get("/", verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendBadRequest(res, "Authenticated user id is missing.");
    }

    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const limit = Math.min(Math.max(parseInt(String(rawLimit || "50"), 10) || 50, 1), 100);
    const bookings = await bookingService.listBookingsForUser(userId, limit);

    return sendSuccess(
      res,
      {
        bookings,
        count: bookings.length,
      },
      "Bookings retrieved"
    );
  } catch (error) {
    return next(error);
  }
});

router.post("/", verifyToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return sendBadRequest(res, "Authenticated user id is missing.");
    }

    const service = typeof req.body?.service === "string" ? req.body.service : "Appointment";
    const status = typeof req.body?.status === "string" ? (req.body.status as BookingStatus) : "pending";

    const booking = await bookingService.createBooking({
      userId,
      businessId: typeof req.body?.business_id === "string" ? req.body.business_id : null,
      source: "manual",
      customerName: typeof req.body?.customer_name === "string" ? req.body.customer_name : null,
      customerPhone: typeof req.body?.customer_phone === "string" ? req.body.customer_phone : null,
      customerEmail: typeof req.body?.customer_email === "string" ? req.body.customer_email : null,
      service,
      appointmentDate: typeof req.body?.appointment_date === "string" ? req.body.appointment_date : null,
      appointmentTime: typeof req.body?.appointment_time === "string" ? req.body.appointment_time : null,
      appointmentAt: typeof req.body?.appointment_at === "string" ? req.body.appointment_at : null,
      status,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
      rawDetails: {
        created_from: "bookings_api",
      },
    });

    return sendCreated(res, booking, "Booking created");
  } catch (error) {
    return next(error);
  }
});

export default router;
