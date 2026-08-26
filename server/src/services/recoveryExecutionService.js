import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { evaluateCaseGuardrailsService } from './guardrailEngineService.js';
import { makeRecoveryDecisionService } from './decisionEngineService.js';
import { createPaymentLinkService } from './razorpayService.js';
import crypto from 'crypto';

/**
 * Payment Link Recovery Execution Service (Phase 11)
 * Safely executes approved PAYMENT_LINK recovery actions in Razorpay TEST MODE.
 */
export const executePaymentLinkRecoveryService = async (caseId, mockRazorpayApi = null) => {
  // 1. Load Recovery Case
  const caseRes = await query(`SELECT * FROM recovery_cases WHERE id = $1;`, [caseId]);
  if (caseRes.rows.length === 0) {
    throw new ApiError(`Recovery Case with ID '${caseId}' not found`, 404);
  }
  const recoveryCase = caseRes.rows[0];

  // 2. Idempotency Check: Existing Active Payment Link Protection
  if (recoveryCase.recovery_link_id && recoveryCase.recovery_link_url) {
    console.log(`[Execution Engine] Active Payment Link '${recoveryCase.recovery_link_id}' already exists for case '${caseId}'. Returning existing link.`);
    return {
      success: true,
      is_duplicate_prevented: true,
      data: {
        action: 'PAYMENT_LINK',
        status: 'SUCCESS',
        payment_link_id: recoveryCase.recovery_link_id,
        payment_link_url: recoveryCase.recovery_link_url
      }
    };
  }

  // 3. Load Customer & Merchant
  const customerRes = await query(`SELECT * FROM customers WHERE id = $1;`, [recoveryCase.customer_id]);
  const customer = customerRes.rows[0];

  // 4. Load Latest Recovery Decision (or generate if missing)
  let decisionRes = await query(`
    SELECT * FROM agent_decisions 
    WHERE recovery_case_id = $1 
    ORDER BY decided_at DESC 
    LIMIT 1;
  `, [caseId]);

  let decision = decisionRes.rows[0];
  if (!decision) {
    const decResult = await makeRecoveryDecisionService(caseId);
    decision = decResult.db_record;
  }

  // 5. Re-run Guardrail Engine IMMEDIATELY before execution
  const guardrailCheck = await evaluateCaseGuardrailsService(caseId, 'PAYMENT_LINK');
  const guardrailResult = guardrailCheck.guardrail_result;

  if (!guardrailResult.allowed) {
    await logAudit(recoveryCase.merchant_id, caseId, 'RECOVERY_ACTION_BLOCKED', {
      reason: guardrailResult.reasons[0],
      guardrail_result: guardrailResult
    });
    throw new ApiError(`Execution Blocked by Guardrail: ${guardrailResult.reasons[0]}`, 400);
  }

  if (guardrailResult.requires_human_approval) {
    await logAudit(recoveryCase.merchant_id, caseId, 'RECOVERY_ACTION_BLOCKED', {
      reason: 'Human approval required before execution.',
      guardrail_result: guardrailResult
    });
    throw new ApiError('Execution Blocked: High-value case requires human approval prior to execution.', 400);
  }

  if (decision.chosen_strategy !== 'PAYMENT_LINK' && guardrailResult.final_action !== 'PAYMENT_LINK') {
    throw new ApiError(`Execution Blocked: Latest approved action is '${decision.chosen_strategy}', not 'PAYMENT_LINK'.`, 400);
  }

  // 6. Create Action Record as PENDING
  const actionId = crypto.randomUUID();
  const insertActionSql = `
    INSERT INTO recovery_actions (
      id,
      recovery_case_id,
      agent_decision_id,
      action_type,
      status,
      response_data,
      executed_at
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP)
    RETURNING id, status, executed_at;
  `;

  await query(insertActionSql, [
    actionId,
    caseId,
    decision.id,
    'CREATE_PAYMENT_LINK',
    'PENDING',
    JSON.stringify({ step: 'INITIATED', amount_paise: recoveryCase.amount_at_risk_paise })
  ]);

  await logAudit(recoveryCase.merchant_id, caseId, 'RECOVERY_ACTION_ATTEMPTED', {
    action_type: 'CREATE_PAYMENT_LINK',
    action_id: actionId,
    amount_paise: recoveryCase.amount_at_risk_paise
  });

  // 7. Call Razorpay TEST MODE Service
  let razorpayResponse;
  try {
    if (mockRazorpayApi) {
      razorpayResponse = await mockRazorpayApi({
        amount_paise: parseInt(recoveryCase.amount_at_risk_paise, 10),
        customer_name: customer ? customer.name : 'Customer',
        customer_email: customer ? customer.email : 'customer@example.com',
        customer_phone: customer ? customer.phone : '+919876543210'
      });
    } else {
      razorpayResponse = await createPaymentLinkService({
        amount_paise: parseInt(recoveryCase.amount_at_risk_paise, 10),
        description: `RazorRecover Payment Recovery for Order #${recoveryCase.id.slice(0, 8)}`,
        customer_name: customer ? customer.name : 'Valued Customer',
        customer_email: customer ? customer.email : 'customer@example.com',
        customer_phone: customer ? customer.phone : '+919876543210',
        notes: {
          recovery_case_id: caseId
        }
      });
    }
  } catch (err) {
    // Handle Razorpay API Failure
    console.error(`[Execution Engine] Razorpay Payment Link creation failed: ${err.message}`);
    
    await query(`
      UPDATE recovery_actions
      SET status = 'FAILED', response_data = $1::jsonb
      WHERE id = $2;
    `, [JSON.stringify({ error: err.message }), actionId]);

    await logAudit(recoveryCase.merchant_id, caseId, 'RECOVERY_ACTION_FAILED', {
      action_type: 'CREATE_PAYMENT_LINK',
      action_id: actionId,
      error: err.message
    });

    throw new ApiError(`Razorpay Payment Link Creation Failed: ${err.message}`, 500);
  }

  // 8. On Success: Update Action Status & Persist Payment Link in recovery_cases
  const linkId = razorpayResponse.id;
  const linkUrl = razorpayResponse.short_url;

  await query(`
    UPDATE recovery_actions
    SET status = 'SUCCESS', response_data = $1::jsonb
    WHERE id = $2;
  `, [JSON.stringify({ payment_link_id: linkId, payment_link_url: linkUrl }), actionId]);

  // Update recovery_cases status to 'RECOVERING' (NOT 'RECOVERED')
  await query(`
    UPDATE recovery_cases
    SET 
      recovery_link_id = $1,
      recovery_link_url = $2,
      status = 'RECOVERING',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3;
  `, [linkId, linkUrl, caseId]);

  await logAudit(recoveryCase.merchant_id, caseId, 'PAYMENT_LINK_CREATED', {
    action_type: 'CREATE_PAYMENT_LINK',
    action_id: actionId,
    payment_link_id: linkId,
    payment_link_url: linkUrl
  });

  return {
    success: true,
    is_duplicate_prevented: false,
    data: {
      action: 'PAYMENT_LINK',
      status: 'SUCCESS',
      payment_link_id: linkId,
      payment_link_url: linkUrl
    }
  };
};

/**
 * Helper to log audit events
 */
async function logAudit(merchantId, caseId, eventType, details) {
  const auditId = crypto.randomUUID();
  await query(`
    INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
    VALUES ($1, $2, $3, $4, $5::jsonb);
  `, [auditId, merchantId, caseId, eventType, JSON.stringify(details)]);
}
