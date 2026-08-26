import { Router } from 'express';
import { getRecoveryActions } from '../controllers/recoveryActionController.js';

const router = Router();

router.get('/', getRecoveryActions);

export default router;
