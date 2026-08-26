import crypto from 'crypto';
import { query } from '../db/index.js';
import { evaluateAndStoreCaseRiskService } from '../services/riskEngineService.js';
import { diagnoseRecoveryCaseService } from '../services/aiDiagnosisService.js';
import { makeRecoveryDecisionService } from '../services/decisionEngineService.js';
import { evaluateCaseGuardrailsService } from '../services/guardrailEngineService.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Interactive Live Simulation Controller for Hackathon Demonstrations
 * Allows judges/users to simulate payment failures and watch the AI recovery pipeline in real time.
 */
export const simulatePaymentFailure = async (req, res, next) => {
  try {
    const {
      amount_rupees = 2499,
      error_reason = 'insufficient_funds',
      customer_name = 'Demo Customer',
      customer_email = 'demo.judge@example.com',
      customer_phone = '+919876543210'
    } = req.body || {};

    const amount_paise = Math.round(Number(amount_rupees) * 100);

    // 1. Fetch or create default merchant
    const merchantRes = await query(`SELECT id FROM merchants LIMIT 1;`, []);
    let merchantId = merchantRes.rows[0]?.id;
    if (!merchantId) {
      merchantId = crypto.randomUUID();
      await query(`
        INSERT INTO merchants (id, name, email, razorpay_merchant_id)
        VALUES ($1, $2, $3, $4);
      `, [merchantId, 'Acme Store Demo', 'demo@razorrecover.ai', 'acc_demo_123']);
    }

    // 2. Create or find customer
    const rzpCustId = `cust_sim_${Date.now()}`;
    const customerId = crypto.randomUUID();
    await query(`
      INSERT INTO customers (id, merchant_id, razorpay_customer_id, name, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [customerId, merchantId, rzpCustId, customer_name, customer_email, customer_phone]);

    // 3. Create failed transaction record
    const txnId = crypto.randomUUID();
    const rzpPaymentId = `pay_sim_${Date.now()}`;
    await query(`
      INSERT INTO transactions (id, merchant_id, customer_id, razorpay_payment_id, razorpay_order_id, amount_paise, currency, method, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'INR', 'upi', 'failed');
    `, [txnId, merchantId, customerId, rzpPaymentId, `order_sim_${Date.now()}`, amount_paise]);

    // 4. Create payment failure record
    const failureId = crypto.randomUUID();
    const eventId = `evt_sim_${Date.now()}`;
    await query(`
      INSERT INTO payment_failures (id, merchant_id, transaction_id, event_id, error_code, error_reason, error_description)
      VALUES ($1, $2, $3, $4, 'SIMULATED_ERROR', $5, 'Simulated payment failure for hackathon demo');
    `, [failureId, merchantId, txnId, eventId, error_reason]);

    // 5. Create recovery case
    const caseId = crypto.randomUUID();
    await query(`
      INSERT INTO recovery_cases (id, merchant_id, customer_id, payment_failure_id, amount_at_risk_paise, amount_recovered_paise, status, attempt_count, contact_count)
      VALUES ($1, $2, $3, $4, $5, 0, 'DETECTED', 0, 0);
    `, [caseId, merchantId, customerId, failureId, amount_paise]);

    // Log audit event
    await logAudit(merchantId, caseId, 'SIMULATION_FAILURE_TRIGGERED', {
      event_id: eventId,
      payment_id: rzpPaymentId,
      amount_rupees,
      error_reason
    });

    // 6. Run Risk Engine (Phase 7)
    const riskResult = await evaluateAndStoreCaseRiskService(caseId);

    // 7. Run AI Diagnosis Agent (Phase 8)
    const aiResult = await diagnoseRecoveryCaseService(caseId);

    // 8. Run Recovery Decision Engine (Phase 9)
    const decisionResult = await makeRecoveryDecisionService(caseId);

    // 9. Run Guardrail Safety Engine (Phase 10)
    const proposedAction = decisionResult.decision?.final_action || 'PAYMENT_LINK';
    const guardrailCheck = await evaluateCaseGuardrailsService(caseId, proposedAction);

    // Return complete simulation pipeline snapshot
    res.status(201).json({
      success: true,
      message: 'Simulated payment failure processed through full AI pipeline',
      data: {
        simulation_event_id: eventId,
        recovery_case_id: caseId,
        amount_rupees,
        error_reason,
        customer_name,
        pipeline_snapshot: {
          risk_engine: riskResult,
          ai_diagnosis: aiResult,
          decision_engine: decisionResult,
          guardrail_engine: guardrailCheck
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

async function logAudit(merchantId, caseId, eventType, details) {
  const auditId = crypto.randomUUID();
  await query(`
    INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
    VALUES ($1, $2, $3, $4, $5::jsonb);
  `, [auditId, merchantId, caseId, eventType, JSON.stringify(details)]);
}
