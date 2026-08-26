import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Deterministic Revenue Risk Detection Engine
 * Scores failed payments strictly between 0 and 100 based on 4 explainable factors.
 */
export const calculateRiskScore = ({
  amount_paise,
  error_reason,
  prior_successful_payments_count = 0,
  created_at = new Date(),
  attempt_count = 0
}) => {
  let score = 0;
  const reasons = [];

  // --- Factor 1: Payment Value Contribution (Max 30 pts) ---
  const amount = Number(amount_paise || 0);
  if (amount >= 1000000) { // ₹10,000+
    score += 30;
    reasons.push('High payment amount (₹10,000+)');
  } else if (amount >= 500000) { // ₹5,000 - ₹9,999
    score += 22;
    reasons.push('Significant payment amount (₹5,000–₹9,999)');
  } else if (amount >= 200000) { // ₹2,000 - ₹4,999
    score += 15;
    reasons.push('Moderate payment amount (₹2,000–₹4,999)');
  } else { // < ₹2,000
    score += 8;
    reasons.push('Low payment amount (<₹2,000)');
  }

  // --- Factor 2: Failure Type Recoverability (Max 30 pts) ---
  const reason = (error_reason || '').toLowerCase();
  if (['bank_timeout', 'gateway_error', 'network_error'].includes(reason)) {
    score += 30;
    reasons.push('Transient failure with high recovery probability');
  } else if (reason === 'otp_timeout') {
    score += 20;
    reasons.push('User abandonment (OTP timeout)');
  } else if (reason === 'insufficient_funds') {
    score += 12;
    reasons.push('Insufficient customer funds');
  } else if (reason === 'card_expired') {
    score += 5;
    reasons.push('Expired card (requires customer action)');
  } else {
    score += 10;
    reasons.push('Standard payment failure');
  }

  // --- Factor 3: Customer History & Loyalty (Max 25 pts) ---
  const priorCount = Number(prior_successful_payments_count || 0);
  if (priorCount >= 2) {
    score += 25;
    reasons.push('Loyal customer with multiple successful payments');
  } else if (priorCount === 1) {
    score += 18;
    reasons.push('Existing customer with 1 prior successful payment');
  } else {
    score += 10;
    reasons.push('First-time customer');
  }

  // --- Factor 4: Recency & Retries (Max 15 pts) ---
  const attempts = Number(attempt_count || 0);
  const failureTime = new Date(created_at).getTime();
  const hoursSinceFailure = (Date.now() - failureTime) / (1000 * 60 * 60);

  if (attempts >= 4) {
    score += 0;
    reasons.push('High retry attempt count (exhausted retries)');
  } else if (attempts === 3) {
    score += 5;
    reasons.push('Multiple retry attempts executed');
  } else if (attempts === 2 || (hoursSinceFailure >= 24 && hoursSinceFailure < 48)) {
    score += 10;
    reasons.push('Recent failure (24–48 hours) with 1 retry');
  } else { // attempts <= 1 and hoursSinceFailure < 24
    score += 15;
    reasons.push('Fresh failure (<24 hours) with no prior retries');
  }

  // Guaranteed Bounded Math: Clamp between 0 and 100
  const riskScore = Math.max(0, Math.min(100, Math.round(score)));

  // Risk Level Mapping
  let riskLevel = 'LOW';
  if (riskScore >= 80) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 60) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 40) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return {
    riskScore,
    riskLevel,
    reasons
  };
};

/**
 * Calculates risk for a specific recovery_case by ID and persists result in database
 */
export const evaluateAndStoreCaseRiskService = async (caseId) => {
  const fetchSql = `
    SELECT 
      rc.id,
      rc.merchant_id,
      rc.customer_id,
      rc.amount_at_risk_paise,
      rc.attempt_count,
      rc.created_at,
      pf.error_reason,
      COALESCE(succ.succ_count, 0) AS prior_successful_payments_count
    FROM recovery_cases rc
    LEFT JOIN payment_failures pf ON rc.payment_failure_id = pf.id
    LEFT JOIN (
      SELECT customer_id, COUNT(*) AS succ_count
      FROM transactions
      WHERE status = 'captured'
      GROUP BY customer_id
    ) succ ON rc.customer_id = succ.customer_id
    WHERE rc.id = $1;
  `;

  const res = await query(fetchSql, [caseId]);
  if (res.rows.length === 0) {
    throw new ApiError(`Recovery case with ID '${caseId}' not found`, 404);
  }

  const row = res.rows[0];

  const riskResult = calculateRiskScore({
    amount_paise: row.amount_at_risk_paise,
    error_reason: row.error_reason,
    prior_successful_payments_count: parseInt(row.prior_successful_payments_count, 10),
    created_at: row.created_at,
    attempt_count: row.attempt_count
  });

  // Update Database Record
  const updateSql = `
    UPDATE recovery_cases
    SET 
      risk_score = $1,
      risk_level = $2,
      risk_reasons = $3::jsonb,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING id, risk_score, risk_level, risk_reasons, updated_at;
  `;

  await query(updateSql, [
    riskResult.riskScore,
    riskResult.riskLevel,
    JSON.stringify(riskResult.reasons),
    caseId
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
    'RISK_SCORE_EVALUATED',
    JSON.stringify(riskResult)
  ]);

  return {
    recovery_case_id: caseId,
    ...riskResult
  };
};

/**
 * Evaluates and stores risk scores for ALL recovery_cases in the database
 */
export const evaluateAllCasesRiskService = async () => {
  const casesRes = await query(`SELECT id FROM recovery_cases;`, []);
  let processedCount = 0;

  for (const row of casesRes.rows) {
    await evaluateAndStoreCaseRiskService(row.id);
    processedCount++;
  }

  // Calculate Distribution Summary
  const statsRes = await query(`
    SELECT 
      risk_level, 
      COUNT(*) AS count,
      MIN(risk_score) AS min_score,
      MAX(risk_score) AS max_score
    FROM recovery_cases
    GROUP BY risk_level;
  `, []);

  const distribution = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };

  statsRes.rows.forEach(r => {
    if (distribution[r.risk_level] !== undefined) {
      distribution[r.risk_level] = parseInt(r.count, 10);
    }
  });

  return {
    totalEvaluated: processedCount,
    distribution
  };
};
