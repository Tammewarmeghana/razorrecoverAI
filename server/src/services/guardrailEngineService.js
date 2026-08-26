import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { makeRecoveryDecisionService } from './decisionEngineService.js';
import crypto from 'crypto';

export const ALLOWED_ACTIONS = [
  'SILENT_RETRY',
  'PAYMENT_LINK',
  'CUSTOMER_REMINDER',
  'HUMAN_REVIEW',
  'NO_ACTION'
];

/**
 * Deterministic Safety Guardrail Engine (Phase 10)
 * Evaluates whether a proposed recovery action is ALLOWED or BLOCKED using 10 sequential rules.
 * Does NOT execute any recovery actions or call Razorpay APIs.
 */
export const evaluateGuardrailRules = ({
  recoveryCase,
  merchant,
  customer,
  transaction,
  decision,
  proposedAction
}) => {
  const checked_rules = [];
  const reasons = [];

  // Step 1: Does the recovery case exist?
  checked_rules.push('1. Recovery Case Existence: CHECKED');
  if (!recoveryCase) {
    return {
      allowed: false,
      requires_human_approval: false,
      final_action: 'NO_ACTION',
      reasons: ['Missing recovery case'],
      checked_rules
    };
  }

  // Step 2: Has it already been recovered?
  checked_rules.push('2. Already Recovered Check: CHECKED');
  if (recoveryCase.status === 'RECOVERED') {
    return {
      allowed: false,
      requires_human_approval: false,
      final_action: 'NO_ACTION',
      reasons: ['Payment has already been recovered.'],
      checked_rules
    };
  }

  // Step 3: Is required data present?
  checked_rules.push('3. Required Data Check: CHECKED');
  const missingData = [];
  if (!merchant) missingData.push('merchant');
  if (!customer) missingData.push('customer');
  if (!transaction) missingData.push('transaction');
  if (!decision) missingData.push('decision');

  if (missingData.length > 0) {
    return {
      allowed: false,
      requires_human_approval: false,
      final_action: 'NO_ACTION',
      reasons: [`Missing required data: ${missingData.join(', ')}`],
      checked_rules
    };
  }

  // Step 4: Is the action valid?
  checked_rules.push('4. Action Validity Check: CHECKED');
  const action = proposedAction || decision.chosen_strategy;
  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return {
      allowed: false,
      requires_human_approval: false,
      final_action: 'NO_ACTION',
      reasons: [`Invalid action: '${action}'`],
      checked_rules
    };
  }

  if (action === 'NO_ACTION') {
    return {
      allowed: false,
      requires_human_approval: false,
      final_action: 'NO_ACTION',
      reasons: ['Proposed action is NO_ACTION. Execution is not required.'],
      checked_rules
    };
  }

  // Step 5: Has the customer opted out?
  checked_rules.push('5. Customer Opt-Out Check: CHECKED');
  if (customer.is_opted_out === true) {
    return {
      allowed: false,
      requires_human_approval: false,
      final_action: 'NO_ACTION',
      reasons: ['Customer has opted out of recovery communication.'],
      checked_rules
    };
  }

  // Step 6: Has the retry limit been reached?
  checked_rules.push('6. Max Retry Limit Check: CHECKED');
  const maxRetries = Number(merchant.max_retry_attempts || 3);
  const attempts = Number(recoveryCase.attempt_count || 0);
  if (action === 'SILENT_RETRY' && attempts >= maxRetries) {
    return {
      allowed: false,
      requires_human_approval: false,
      final_action: 'NO_ACTION',
      reasons: ['Maximum retry limit reached.'],
      checked_rules
    };
  }

  // Step 7: Has the contact limit been reached?
  checked_rules.push('7. Max Contact Limit Check: CHECKED');
  const maxContacts = Number(merchant.max_contact_count || 2);
  const contacts = Number(recoveryCase.contact_count || 0);
  if (['PAYMENT_LINK', 'CUSTOMER_REMINDER'].includes(action) && contacts >= maxContacts) {
    return {
      allowed: false,
      requires_human_approval: false,
      final_action: 'NO_ACTION',
      reasons: ['Maximum customer contact limit reached.'],
      checked_rules
    };
  }

  // Step 8: Is the transaction high value? (≥ ₹15,000)
  checked_rules.push('8. High-Value Transaction Check: CHECKED');
  const amountPaise = Number(recoveryCase.amount_at_risk_paise || transaction.amount_paise || 0);
  if (amountPaise >= 1500000) { // ₹15,000
    return {
      allowed: true,
      requires_human_approval: true,
      final_action: 'HUMAN_REVIEW',
      reasons: ['High-value recovery requires human approval.'],
      checked_rules
    };
  }

  // Step 9: Is the diagnosis UNKNOWN?
  checked_rules.push('9. Unknown Diagnosis Check: CHECKED');
  if (decision.diagnosed_root_cause === 'UNKNOWN') {
    return {
      allowed: false,
      requires_human_approval: true,
      final_action: 'HUMAN_REVIEW',
      reasons: ['Unknown diagnosis requires human review.'],
      checked_rules
    };
  }

  // Step 10: Final ALLOWED Decision
  checked_rules.push('10. Final Safety Approval: PASSED');
  const requiresApproval = action === 'HUMAN_REVIEW';

  return {
    allowed: true,
    requires_human_approval: requiresApproval,
    final_action: action,
    reasons: [`Action ${action} satisfied all safety guardrails.`],
    checked_rules
  };
};

/**
 * Service to execute Guardrail Check on a recovery_case by ID
 */
export const evaluateCaseGuardrailsService = async (caseId, customProposedAction = null) => {
  // 1. Fetch Recovery Case
  const caseRes = await query(`SELECT * FROM recovery_cases WHERE id = $1;`, [caseId]);
  if (caseRes.rows.length === 0) {
    const result = evaluateGuardrailRules({ recoveryCase: null });
    return { recovery_case_id: caseId, ...result };
  }
  const recoveryCase = caseRes.rows[0];

  // 2. Fetch Merchant
  const merchantRes = await query(`SELECT * FROM merchants WHERE id = $1;`, [recoveryCase.merchant_id]);
  const merchant = merchantRes.rows[0] || null;

  // 3. Fetch Customer
  const customerRes = await query(`SELECT * FROM customers WHERE id = $1;`, [recoveryCase.customer_id]);
  const customer = customerRes.rows[0] || null;

  // 4. Fetch Payment Failure & Transaction
  const failureRes = await query(`SELECT * FROM payment_failures WHERE id = $1;`, [recoveryCase.payment_failure_id]);
  const failure = failureRes.rows[0] || null;

  let transaction = null;
  if (failure) {
    const txRes = await query(`SELECT * FROM transactions WHERE id = $1;`, [failure.transaction_id]);
    transaction = txRes.rows[0] || null;
  }

  // 5. Fetch Latest Agent Decision (or calculate if missing)
  let decision = null;
  const decisionRes = await query(`
    SELECT * FROM agent_decisions 
    WHERE recovery_case_id = $1 
    ORDER BY decided_at DESC 
    LIMIT 1;
  `, [caseId]);

  if (decisionRes.rows.length > 0) {
    decision = decisionRes.rows[0];
  } else {
    // Generate Decision if missing
    const decResult = await makeRecoveryDecisionService(caseId);
    decision = decResult.db_record;
  }

  const proposedAction = customProposedAction || decision.chosen_strategy;

  // 6. Run Guardrail Evaluation Rules
  const result = evaluateGuardrailRules({
    recoveryCase,
    merchant,
    customer,
    transaction,
    decision,
    proposedAction
  });

  // 7. Write Audit Log
  const eventType = result.allowed ? 'GUARDRAIL_PASSED' : 'GUARDRAIL_BLOCKED';
  const auditId = crypto.randomUUID();

  await query(`
    INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
    VALUES ($1, $2, $3, $4, $5::jsonb);
  `, [
    auditId,
    recoveryCase.merchant_id,
    caseId,
    eventType,
    JSON.stringify({
      proposed_action: proposedAction,
      allowed: result.allowed,
      requires_human_approval: result.requires_human_approval,
      final_action: result.final_action,
      reasons: result.reasons,
      timestamp: new Date().toISOString()
    })
  ]);

  return {
    recovery_case_id: caseId,
    proposed_action: proposedAction,
    merchant_limits: {
      max_retry_attempts: merchant ? merchant.max_retry_attempts : null,
      max_contact_count: merchant ? merchant.max_contact_count : null
    },
    case_counters: {
      attempt_count: recoveryCase.attempt_count,
      contact_count: recoveryCase.contact_count
    },
    customer_opted_out: customer ? customer.is_opted_out : null,
    guardrail_result: result
  };
};
