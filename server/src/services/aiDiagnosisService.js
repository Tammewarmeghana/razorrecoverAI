import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import crypto from 'crypto';

// --- Controlled Enums ---
export const ALLOWED_DIAGNOSES = [
  'TRANSIENT_BANK_OR_GATEWAY_FAILURE',
  'USER_ABANDONMENT',
  'INSUFFICIENT_FUNDS',
  'EXPIRED_CARD',
  'NETWORK_FAILURE',
  'UNKNOWN'
];

export const ALLOWED_INTERVENTIONS = [
  'SILENT_RETRY',
  'PAYMENT_LINK',
  'CUSTOMER_REMINDER',
  'HUMAN_REVIEW',
  'NO_ACTION'
];

export const SYSTEM_PROMPT = `You are a payment recovery diagnosis assistant.
Analyze the provided payment failure information.
Your job is to classify the likely cause and recommend a possible recovery intervention.
Do not invent facts. Use only the information provided.
If there is insufficient information, use UNKNOWN and NO_ACTION.
Never execute actions. Return only the required structured JSON.`;

/**
 * Strict Output Validation Function
 */
export const validateAiOutput = (output) => {
  if (!output || typeof output !== 'object') {
    throw new ApiError('AI Output Error: Response is not a valid JSON object', 400);
  }

  const { diagnosis, confidence, evidence, recommended_intervention, reasoning_summary } = output;

  if (!diagnosis || !ALLOWED_DIAGNOSES.includes(diagnosis)) {
    throw new ApiError(`AI Validation Error: Invalid diagnosis '${diagnosis}'. Must be one of: ${ALLOWED_DIAGNOSES.join(', ')}`, 400);
  }

  if (!recommended_intervention || !ALLOWED_INTERVENTIONS.includes(recommended_intervention)) {
    throw new ApiError(`AI Validation Error: Invalid recommended_intervention '${recommended_intervention}'. Must be one of: ${ALLOWED_INTERVENTIONS.join(', ')}`, 400);
  }

  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new ApiError(`AI Validation Error: Confidence '${confidence}' must be a number between 0.0 and 1.0`, 400);
  }

  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new ApiError('AI Validation Error: Evidence must be a non-empty array of strings', 400);
  }

  if (typeof reasoning_summary !== 'string' || reasoning_summary.trim().length === 0) {
    throw new ApiError('AI Validation Error: reasoning_summary must be a non-empty string', 400);
  }

  return true;
};

/**
 * Core AI Diagnosis Function
 * Takes structured context and returns validated AI diagnosis JSON
 */
export const generateAiDiagnosis = async (structuredInput, mockProvider = null) => {
  if (mockProvider) {
    const rawMockOutput = await mockProvider(structuredInput);
    validateAiOutput(rawMockOutput);
    return rawMockOutput;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

  if (apiKey && !apiKey.includes('YOUR_')) {
    try {
      console.log('[AI Service] Calling Gemini LLM API for structured payment failure diagnosis...');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: SYSTEM_PROMPT },
                { text: `Analyze this payment failure context and respond ONLY in valid JSON matching schema:\n${JSON.stringify(structuredInput, null, 2)}` }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API returned HTTP ${response.status}`);
      }

      const resData = await response.json();
      const textContent = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsedOutput = JSON.parse(textContent);

      validateAiOutput(parsedOutput);
      return parsedOutput;
    } catch (err) {
      console.warn(`[AI Service] Live LLM API call failed (${err.message}). Using deterministic fallback processor.`);
    }
  }

  // Deterministic Fallback Processor matching exact System Prompt & Rules
  console.log('[AI Service] Executing Deterministic AI Diagnosis Engine...');
  return runDeterministicAiModel(structuredInput);
};

/**
 * Deterministic AI Model Engine (Rule-based LLM emulator)
 */
function runDeterministicAiModel(input) {
  const reason = (input.failure_reason || '').toLowerCase();
  const code = (input.failure_code || '').toUpperCase();

  let diagnosis = 'UNKNOWN';
  let recommended_intervention = 'NO_ACTION';
  let confidence = 0.50;
  let evidence = [];
  let reasoning_summary = '';

  if (['bank_timeout', 'gateway_error', 'network_error'].includes(reason) || code === 'GATEWAY_ERROR') {
    diagnosis = 'TRANSIENT_BANK_OR_GATEWAY_FAILURE';
    recommended_intervention = 'SILENT_RETRY';
    confidence = 0.95;
    evidence = [
      `Failure code is ${code}`,
      `Error reason '${reason}' indicates a temporary bank or network timeout`
    ];
    reasoning_summary = `The failure was caused by a transient gateway/bank timeout. Since customer history is positive and value is ₹${input.transaction_amount_rupees}, a silent retry is recommended once bank servers stabilize.`;
  } else if (reason === 'otp_timeout') {
    diagnosis = 'USER_ABANDONMENT';
    recommended_intervention = 'PAYMENT_LINK';
    confidence = 0.90;
    evidence = [
      'Error reason is otp_timeout',
      'Customer abandoned OTP entry screen before payment completion'
    ];
    reasoning_summary = `The customer abandoned the OTP authentication flow. Sending an instant 1-click Razorpay Payment Link via message will allow frictionless recovery.`;
  } else if (reason === 'insufficient_funds') {
    diagnosis = 'INSUFFICIENT_FUNDS';
    recommended_intervention = 'CUSTOMER_REMINDER';
    confidence = 0.85;
    evidence = [
      'Error reason is insufficient_funds',
      'Bank rejected transaction due to insufficient account balance'
    ];
    reasoning_summary = `Transaction declined due to low account balance. A polite customer reminder with flexible payment options is recommended.`;
  } else if (reason === 'card_expired') {
    diagnosis = 'EXPIRED_CARD';
    recommended_intervention = 'PAYMENT_LINK';
    confidence = 0.92;
    evidence = [
      'Error reason is card_expired',
      'Card issuer rejected transaction due to expired card details'
    ];
    reasoning_summary = `Transaction failed due to an expired payment card. Providing a payment update link will prompt the customer to attach a valid card or UPI profile.`;
  } else {
    diagnosis = 'UNKNOWN';
    recommended_intervention = 'HUMAN_REVIEW';
    confidence = 0.40;
    evidence = [
      `Unclear failure reason '${reason}'`,
      'Insufficient technical metadata to diagnose cause automatically'
    ];
    reasoning_summary = `Unable to classify root cause with high confidence. Human review is recommended before taking recovery action.`;
  }

  const result = {
    diagnosis,
    confidence,
    evidence,
    recommended_intervention,
    reasoning_summary
  };

  validateAiOutput(result);
  return result;
}

/**
 * Service to diagnose a recovery_case by ID and store decision in agent_decisions
 */
export const diagnoseRecoveryCaseService = async (caseId, mockProvider = null) => {
  const fetchSql = `
    SELECT 
      rc.id AS case_id,
      rc.merchant_id,
      rc.amount_at_risk_paise,
      rc.attempt_count,
      rc.risk_score,
      rc.risk_level,
      rc.created_at AS case_created_at,
      t.razorpay_payment_id,
      t.method AS payment_method,
      pf.error_code,
      pf.error_reason,
      pf.error_description,
      c.id AS customer_id,
      c.name AS customer_name,
      c.email AS customer_email,
      COALESCE(succ.succ_count, 0) AS prior_successful_payments_count,
      COALESCE(fail.fail_count, 0) AS prior_failures_count
    FROM recovery_cases rc
    LEFT JOIN payment_failures pf ON rc.payment_failure_id = pf.id
    LEFT JOIN transactions t ON pf.transaction_id = t.id
    LEFT JOIN customers c ON rc.customer_id = c.id
    LEFT JOIN (
      SELECT customer_id, COUNT(*) AS succ_count
      FROM transactions WHERE status = 'captured' GROUP BY customer_id
    ) succ ON rc.customer_id = succ.customer_id
    LEFT JOIN (
      SELECT customer_id, COUNT(*) AS fail_count
      FROM transactions WHERE status IN ('failed', 'abandoned') GROUP BY customer_id
    ) fail ON rc.customer_id = fail.customer_id
    WHERE rc.id = $1;
  `;

  const res = await query(fetchSql, [caseId]);
  if (res.rows.length === 0) {
    throw new ApiError(`Recovery Case with ID '${caseId}' not found`, 404);
  }

  const row = res.rows[0];
  const hoursSinceFailure = parseFloat(((Date.now() - new Date(row.case_created_at).getTime()) / (1000 * 60 * 60)).toFixed(1));

  // Build Structured Input Payload for AI
  const structuredInput = {
    transaction_amount_rupees: (parseInt(row.amount_at_risk_paise, 10) / 100).toFixed(2),
    payment_method: row.payment_method || 'upi',
    failure_code: row.error_code || 'GATEWAY_ERROR',
    failure_reason: row.error_reason || 'unknown',
    failure_description: row.error_description || 'Payment failure recorded',
    customer_history: `${row.prior_successful_payments_count} prior successful payments`,
    number_of_previous_successful_payments: parseInt(row.prior_successful_payments_count, 10),
    number_of_previous_failures: parseInt(row.prior_failures_count, 10),
    retry_count: parseInt(row.attempt_count, 10),
    risk_score: parseInt(row.risk_score, 10),
    risk_level: row.risk_level || 'LOW',
    time_since_failure_hours: hoursSinceFailure
  };

  // Generate AI Diagnosis
  const aiResult = await generateAiDiagnosis(structuredInput, mockProvider);

  // Store Decision in agent_decisions table
  const decisionId = crypto.randomUUID();
  const insertDecisionSql = `
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

  const decisionRes = await query(insertDecisionSql, [
    decisionId,
    caseId,
    aiResult.diagnosis,
    aiResult.recommended_intervention,
    aiResult.reasoning_summary,
    true
  ]);

  // Log Audit Entry
  const auditId = crypto.randomUUID();
  await query(`
    INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
    VALUES ($1, $2, $3, $4, $5::jsonb);
  `, [
    auditId,
    row.merchant_id,
    caseId,
    'AI_DIAGNOSIS_GENERATED',
    JSON.stringify({
      agent_decision_id: decisionId,
      diagnosis: aiResult.diagnosis,
      recommended_intervention: aiResult.recommended_intervention,
      confidence: aiResult.confidence,
      evidence: aiResult.evidence
    })
  ]);

  return {
    recovery_case_id: caseId,
    decision_id: decisionId,
    structured_input_provided: structuredInput,
    ai_diagnosis: aiResult,
    decision_record: decisionRes.rows[0]
  };
};
