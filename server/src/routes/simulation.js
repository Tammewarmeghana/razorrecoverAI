import express from 'express';
import { simulatePaymentFailure } from '../controllers/simulationController.js';

const router = express.Router();

// POST /api/simulation/simulate-failure
router.post('/simulate-failure', simulatePaymentFailure);

export default router;
