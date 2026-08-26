import express from 'express';
import { getMerchantConfig, updateMerchantConfig } from '../controllers/merchantPolicyController.js';

const router = express.Router();

// GET /api/merchants/config
router.get('/config', getMerchantConfig);

// PUT /api/merchants/config
router.put('/config', updateMerchantConfig);

export default router;
