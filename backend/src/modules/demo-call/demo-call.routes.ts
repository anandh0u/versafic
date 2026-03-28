import { Router } from 'express';
import { verifyToken } from '../../middleware/jwt-auth';
import {
  listDemoCallSessions,
  simulateIncomingDemoCall,
  simulateOutboundDemoCall,
} from './demo-call.controller';

const router = Router();

router.get('/sessions', verifyToken, listDemoCallSessions);
router.post('/outbound', verifyToken, simulateOutboundDemoCall);
router.post('/incoming', verifyToken, simulateIncomingDemoCall);

export default router;
