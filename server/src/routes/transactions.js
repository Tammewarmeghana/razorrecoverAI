import { Router } from 'express';
import { getTransactions, getTransactionById } from '../controllers/transactionController.js';

const router = Router();

router.get('/', getTransactions);
router.get('/:id', getTransactionById);

export default router;
