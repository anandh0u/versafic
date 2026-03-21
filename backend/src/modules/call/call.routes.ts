// src/modules/call/call.routes.ts - Routes for Twilio call handling
import { Router } from 'express';
import {
  handleIncomingCall,
  handleRecording,
  getCallRecordings,
  getCallRecordingByCallSid
} from './call.controller';

const router = Router();

// Twilio webhook endpoints (no authentication required for webhooks)
router.post('/incoming', handleIncomingCall);
router.post('/recording', handleRecording);

// API endpoints for managing recordings (require authentication)
router.get('/recordings', getCallRecordings);
router.get('/recordings/:callSid', getCallRecordingByCallSid);

export default router;