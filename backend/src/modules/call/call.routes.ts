// src/modules/call/call.routes.ts - Routes for Twilio call handling
import { Router } from 'express';
import { verifyToken } from '../../middleware/jwt-auth';
import {
  initiateOutboundCall,
  getCallConfig,
  getPublicCallConfig,
  getCallSessions,
  handleIncomingCall,
  renderOutboundTwiML,
  handleOutboundResponse,
  handleCallStatus,
  handleRecording,
  getCallRecordings,
  getCallRecordingByCallSid
} from './call.controller';

const router = Router();

// Twilio webhook endpoints (no authentication required for webhooks)
router.post('/incoming', handleIncomingCall);
router.post('/outbound/twiml', renderOutboundTwiML);
router.post('/outbound/respond', handleOutboundResponse);
router.post('/status', handleCallStatus);
router.post('/recording', handleRecording);

// API endpoints for managing recordings (require authentication)
router.get('/public-config', getPublicCallConfig);
router.get('/config', verifyToken, getCallConfig);
router.get('/sessions', verifyToken, getCallSessions);
router.post('/outbound', verifyToken, initiateOutboundCall);
router.get('/recordings', verifyToken, getCallRecordings);
router.get('/recordings/:callSid', verifyToken, getCallRecordingByCallSid);

export default router;
