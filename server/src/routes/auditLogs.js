import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLogController.js';

const router = Router();

router.get('/', getAuditLogs);

export default router;
