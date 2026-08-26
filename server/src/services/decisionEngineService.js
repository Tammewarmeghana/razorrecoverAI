import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { diagnoseRecoveryCaseService } from './aiDiagnosisService.js';
import crypto from 'crypto';

// --- Allowed Final Actions ---
export const ALLOWED_FINAL_ACTIONS = [
  'SILENT_RETRY',
  'PAYMENT_LINK',
  'CUSTOMER_REMINDER',
  'HUMAN_REVIEW',
  'NO_ACTION'
];

/**
 * Deterministic Decision Engine
 * Combines Risk Score + AI Diagnosis + Merchant Rules + Case Metadata
 * to produce the final recovery action recommendation.
 */
export const calculateRecoveryDecision = ({
  caseStatus,
  amountPaise,
  attemptCount,
  maxRetryAttempts = 3,
  riskScore,
  riskLevel,
  aiDiagnosis,
  aiRecommendation,
  aiConfidence = 0.50
}) => {
  const amountRupees = (Number(amountPaise || 0) / 100).toFixed(2);
  const decisionFactors = [];

  decisionFactors.push(`Case Status: ${caseStatus}`);
  decisionFactors.push(`Amount: ₹${amountRupees}`);
  decisionFactors.push(`Risk Level: ${riskLevel} (Score ${riskScore})`);
  decisionFactors.push(`AI Diagnosis: ${aiDiagnosis || 'UNKNOWN'}`);
  decisionFactors.push(`AI Recommended: ${aiRecommendation || 'NO_ACTION'}`);
  decisionFactors.push(`Retry Attempts: ${attemptCount} of ${maxRetryAttempts}`);

  // Rule 1: Completed or Inactive Cases
  if (['RECOVERED', 'EXPIRED', 'HALTED_GUARDRAIL'].includes(caseStatus)) {
    return {
      final_action: 'NO_ACTION',
      reason: `Case status is '${caseStatus}'. Recovery workflow is already complete or inactive.`,
      confidence: 1.0,
      requires_human_approval: false,
      decision_factors: decisionFactors
    };
  }

  // Rule 2: High-Value or High-Ambiguity Review Requirement
  const isHighValue = Number(amountPaise) >= 1500000; // ≥ ₹15,000
  const isLowConfidence = Number(aiConfidence) < 0.60;
  const isUnknownDiagnosis = !aiDiagnosis || aiDiagnosis === 'UNKNOWN';

  if (isUnknownDiagnosis || isLowConfidence || isHighValue) {
    let reasonMsg = 'Diagnosis is UNKNOWN. Requires human admin review.';
    if (isHighValue) {
      reasonMsg = `High-value transaction (₹${amountRupees}). Requires human admin review before recovery outreach.`;
    } else if (isLowConfidence) {
      reasonMsg = `Low AI confidence (${aiConfidence}). Human review required.`;
    }

    return {
      final_action: 'HUMAN_REVIEW',
      reason: reasonMsg,
      confidence: aiConfidence || 0.50,
      requires_human_approval: true,
      decision_factors: decisionFactors
    };
  }

  // Rule 3: Transient Bank / Gateway Failure
  if (aiDiagnosis === 'TRANSIENT_BANK_OR_GATEWAY_FAILURE') {
    if (attemptCount < maxRetryAttempts) {
      return {
        final_action: 'SILENT_RETRY',
        reason: 'Transient gateway/bank failure with high recovery probability. Recommended for background silent retry once bank server recovers.',
        confidence: aiConfidence || 0.95,
        requires_human_approval: false,
        decision_factors: decisionFactors
      };
    } else {
      return {
        final_action: 'PAYMENT_LINK',
        reason: `Maximum automated retry attempts (${maxRetryAttempts}) reached for bank failure. Switching to 1-click Payment Link.`,
        confidence: 0.85,
        requires_human_approval: false,
        decision_factors: decisionFactors
      };
    }
  }

  // Rule 4: User Abandonment (OTP Timeout)
  if (aiDiagnosis === 'USER_ABANDONMENT') {
    return {
      final_action: 'PAYMENT_LINK',
      reason: 'Customer abandoned OTP screen. Sending an instant 1-click Razorpay Payment Link is the optimal intervention.',
      confidence: aiConfidence || 0.90,
      requires_human_approval: false,
      decision_factors: decisionFactors
    };
  }

  // Rule 5: Insufficient Account Balance
  if (aiDiagnosis === 'INSUFFICIENT_FUNDS') {
    if (riskLevel === 'CRITICAL' || Number(amountPaise) >= 1000000) {
      return {
        final_action: 'PAYMENT_LINK',
        reason: 'High-value insufficient balance failure. Instant Payment Link generated for customer flexibility.',
        confidence: aiConfidence || 0.85,
        requires_human_approval: false,
        decision_factors: decisionFactors
      };
    } else {
      return {
        final_action: 'CUSTOMER_REMINDER',
        reason: 'Transaction declined due to low balance. Gentle customer reminder is recommended.',
        confidence: aiConfidence || 0.85,
        requires_human_approval: false,
        decision_factors: decisionFactors
      };
    }
  }

  // Rule 6: Expired Payment Card
  if (aiDiagnosis === 'EXPIRED_CARD') {
    // Conflict resolution: if AI mistakenly suggested SILENT_RETRY for expired card, override to PAYMENT_LINK
    return {
      final_action: 'PAYMENT_LINK',
      reason: 'Expired card details require customer to provide updated payment method via Payment Link.',
      confidence: aiConfidence || 0.90,
      requires_human_approval: false,
      decision_factors: decisionFactors
    };
  }

  // Rule 7: Network Failure
  if (aiDiagnosis === 'NETWORK_FAILURE') {
    return {
      final_action: 'SILENT_RETRY',
      reason: 'Transient network disconnect. Recommended for short-delay background retry.',
      confidence: aiConfidence || 0.88,
      requires_human_approval: false,
      decision_factors: decisionFactors
    };
  }

  // Default Fallback Rule
  return {
    final_action: 'HUMAN_REVIEW',
    reason: 'Standard fallback rule. Recommended for human admin evaluation.',
    confidence: 0.50,
    requires_human_approval: true,
    decision_factors: decisionFactors
  };
};

/**
 * Service to execute decision engine for a recovery_case by ID and persist in DB
 */
export const makeRecoveryDecisionService = async (caseId) => {
  // 1. Fetch recovery case & merchant metadata
  const caseSql = `
    SELECT 
      rc.id AS case_id,
      rc.merchant_id,
      rc.amount_at_risk_paise,
      rc.attempt_count,
      rc.status AS case_status,
      rc.risk_score,
      rc.risk_level,
      m.max_retry_attempts
    FROM recovery_cases rc
    LEFT JOIN merchants m ON rc.merchant_id = m.id
    WHERE rc.id = $1;
  `;

  const caseRes = await query(caseSql, [caseId]);
  if (caseRes.rows.length === 0) {
    throw new ApiError(`Recovery Case with ID '${caseId}' not found`, 404);
  }

  const row = caseRes.rows[0];

  // 2. Fetch latest AI Diagnosis for this case (or generate if missing)
  const decisionSql = `
    SELECT diagnosed_root_cause, chosen_strategy, reasoning, decided_at
    FROM agent_decisions
    WHERE recovery_case_id = $1
    ORDER BY decided_at DESC
    LIMIT 1;
  `;

  let decisionRow = (await query(decisionSql, [caseId])).rows[0];

  if (!decisionRow) {
    // Generate AI Diagnosis if not performed yet
    const diagRes = await diagnoseRecoveryCaseService(caseId);
    decisionRow = {
      diagnosed_root_cause: diagRes.ai_diagnosis.diagnosis,
      chosen_strategy: diagRes.ai_diagnosis.recommended_intervention,
      reasoning: diagRes.ai_diagnosis.reasoning_summary,
      confidence: diagRes.ai_diagnosis.confidence
    };
  }

  // 3. Compute Final Recovery Decision
  const finalDecision = calculateRecoveryDecision({
    caseStatus: row.case_status,
    amountPaise: row.amount_at_risk_paise,
    attemptCount: row.attempt_count,
    maxRetryAttempts: row.max_retry_attempts || 3,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    aiDiagnosis: decisionRow.diagnosed_root_cause,
    aiRecommendation: decisionRow.chosen_strategy,
    aiConfidence: decisionRow.confidence || 0.85
  });

  // 4. Persist Decision Record in agent_decisions
  const newDecisionId = crypto.randomUUID();
  const insertSql = `
    INSERT INTO agent_decisions (
      id,
      recovery_case_id,
      diagnosed_root_cause,
      chosen_strategy,
      reasoning,
      guardrails_passed,
      decided_at
    ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    RETURNING id, recovery_case_id, diagnosed_root_cause, chosen_strategy, reasoning, guardrails_passed, decided_at;
  `;

  const reasoningPayload = JSON.stringify({
    summary: finalDecision.reason,
    requires_human_approval: finalDecision.requires_human_approval,
    confidence: finalDecision.confidence,
    decision_factors: finalDecision.decision_factors
  });

  const insertedRes = await query(insertSql, [
    newDecisionId,
    caseId,
    decisionRow.diagnosed_root_cause || 'UNKNOWN',
    finalDecision.final_action,
    reasoningPayload,
    true
  ]);

  // 5. Log Audit Event
  const auditId = crypto.randomUUID();
  await query(`
    INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
    VALUES ($1, $2, $3, $4, $5::jsonb);
  `, [
    auditId,
    row.merchant_id,
    caseId,
    'RECOVERY_DECISION_GENERATED',
    JSON.stringify({
      decision_id: newDecisionId,
      final_action: finalDecision.final_action,
      requires_human_approval: finalDecision.requires_human_approval,
      reason: finalDecision.reason
    })
  ]);

  return {
    recovery_case_id: caseId,
    risk_summary: {
      score: row.risk_score,
      level: row.risk_level
    },
    ai_diagnosis_summary: {
      diagnosis: decisionRow.diagnosed_root_cause,
      ai_recommendation: decisionRow.chosen_strategy
    },
    final_decision: finalDecision,
    db_record: insertedRes.rows[0]
  };
};
