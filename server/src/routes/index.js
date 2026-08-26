import { Router } from 'express';
import transactionsRouter from './transactions.js';
import recoveryCasesRouter from './recoveryCases.js';
import recoveryActionsRouter from './recoveryActions.js';
import auditLogsRouter from './auditLogs.js';
import metricsRouter from './metrics.js';
import webhooksRouter from './webhooks.js';
import simulationRouter from './simulation.js';
import merchantPolicyRouter from './merchantPolicy.js';
import { getBenchmarkMetrics } from '../controllers/benchmarkController.js';

const router = Router();

router.use('/transactions', transactionsRouter);
router.use('/recovery-cases', recoveryCasesRouter);
router.use('/recovery-actions', recoveryActionsRouter);
router.use('/audit-logs', auditLogsRouter);
router.use('/metrics', metricsRouter);
router.get('/metrics-benchmark', getBenchmarkMetrics);
router.use('/webhooks', webhooksRouter);
router.use('/simulation', simulationRouter);
router.use('/merchants', merchantPolicyRouter);

export default router;
