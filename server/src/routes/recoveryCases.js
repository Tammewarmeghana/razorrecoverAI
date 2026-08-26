import { Router } from 'express';
import { 
  getRecoveryCases, 
  getRecoveryCaseById, 
  evaluateCaseRisk, 
  evaluateAllCasesRisk,
  diagnoseRecoveryCase,
  makeRecoveryDecision,
  evaluateCaseGuardrails,
  executePaymentLinkRecovery
} from '../controllers/recoveryCaseController.js';
import { approveCaseRecovery, rejectCaseRecovery } from '../controllers/humanApprovalController.js';

const router = Router();

router.get('/', getRecoveryCases);
router.post('/evaluate-all-risk', evaluateAllCasesRisk);
router.get('/:id', getRecoveryCaseById);
router.post('/:id/evaluate-risk', evaluateCaseRisk);
router.post('/:id/diagnose', diagnoseRecoveryCase);
router.post('/:id/decide', makeRecoveryDecision);
router.post('/:id/guardrail-check', evaluateCaseGuardrails);
router.post('/:id/execute', executePaymentLinkRecovery);
router.post('/:id/approve', approveCaseRecovery);
router.post('/:id/reject', rejectCaseRecovery);

export default router;
