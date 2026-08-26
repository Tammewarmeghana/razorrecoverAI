import { calculateRiskScore, evaluateAllCasesRiskService, evaluateAndStoreCaseRiskService } from '../services/riskEngineService.js';
import { query } from '../db/index.js';

async function runRiskEngineTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 7 RISK ENGINE TEST SUITE    ');
  console.log('======================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASSED: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      failedTests++;
    }
  }

  // --- Test 1: High-value temporary failure ---
  console.log('Test 1: High-Value Temporary Failure (₹12,000, bank_timeout, 2 prior payments)');
  const res1 = calculateRiskScore({
    amount_paise: 1200000,
    error_reason: 'bank_timeout',
    prior_successful_payments_count: 2,
    created_at: new Date(),
    attempt_count: 0
  });
  assert(res1.riskScore === 100, `Score is exactly 100 (Got: ${res1.riskScore})`);
  assert(res1.riskLevel === 'CRITICAL', `Level is CRITICAL (Got: ${res1.riskLevel})`);

  // --- Test 2: Low-value permanent failure ---
  console.log('\nTest 2: Low-Value Permanent Failure (₹999, card_expired, 0 prior payments, 4 attempts)');
  const res2 = calculateRiskScore({
    amount_paise: 99900,
    error_reason: 'card_expired',
    prior_successful_payments_count: 0,
    created_at: new Date(Date.now() - 72 * 3600 * 1000),
    attempt_count: 4
  });
  assert(res2.riskScore === 23, `Score is exactly 23 (Got: ${res2.riskScore})`);
  assert(res2.riskLevel === 'LOW', `Level is LOW (Got: ${res2.riskLevel})`);

  // --- Test 3: Customer with Successful Payment History ---
  console.log('\nTest 3: Customer with Successful History (₹3,500, otp_timeout, 1 prior payment)');
  const res3 = calculateRiskScore({
    amount_paise: 350000,
    error_reason: 'otp_timeout',
    prior_successful_payments_count: 1,
    created_at: new Date(),
    attempt_count: 1
  });
  assert(res3.riskScore === 68, `Score is exactly 68 (Got: ${res3.riskScore})`);
  assert(res3.riskLevel === 'HIGH', `Level is HIGH (Got: ${res3.riskLevel})`);

  // --- Test 4: Customer with Repeated Failures (Attempt Penalty Reduction) ---
  console.log('\nTest 4: Impact of Repeated Failure Attempts');
  const res4a = calculateRiskScore({
    amount_paise: 500000,
    error_reason: 'insufficient_funds',
    prior_successful_payments_count: 1,
    created_at: new Date(),
    attempt_count: 1
  });
  const res4b = calculateRiskScore({
    amount_paise: 500000,
    error_reason: 'insufficient_funds',
    prior_successful_payments_count: 1,
    created_at: new Date(),
    attempt_count: 4
  });
  assert(res4a.riskScore > res4b.riskScore, `Score reduced from ${res4a.riskScore} to ${res4b.riskScore} when attempt count increased to 4`);

  // --- Test 5: Boundary Values for Risk Levels ---
  console.log('\nTest 5: Boundary Values (LOW <40, MEDIUM 40-59, HIGH 60-79, CRITICAL >=80)');
  
  // Force score 28 (LOW < 40)
  const bLow = calculateRiskScore({ amount_paise: 99900, error_reason: 'card_expired', prior_successful_payments_count: 0, attempt_count: 3 });
  assert(bLow.riskScore < 40 && bLow.riskLevel === 'LOW', `Boundary Score ${bLow.riskScore} maps to LOW (<40)`);

  // Force score 42 (MEDIUM 40-59)
  const bMed = calculateRiskScore({ amount_paise: 200000, error_reason: 'insufficient_funds', prior_successful_payments_count: 0, attempt_count: 3 });
  assert(bMed.riskScore >= 40 && bMed.riskScore < 60 && bMed.riskLevel === 'MEDIUM', `Boundary Score ${bMed.riskScore} maps to MEDIUM (40-59)`);

  // Force score 65 (HIGH 60-79)
  const bHigh = calculateRiskScore({ amount_paise: 500000, error_reason: 'otp_timeout', prior_successful_payments_count: 1, attempt_count: 3 });
  assert(bHigh.riskScore >= 60 && bHigh.riskScore < 80 && bHigh.riskLevel === 'HIGH', `Boundary Score ${bHigh.riskScore} maps to HIGH (60-79)`);

  // Force score 83 (CRITICAL >= 80)
  const bCrit = calculateRiskScore({ amount_paise: 1000000, error_reason: 'bank_timeout', prior_successful_payments_count: 1, attempt_count: 3 });
  assert(bCrit.riskScore >= 80 && bCrit.riskLevel === 'CRITICAL', `Boundary Score ${bCrit.riskScore} maps to CRITICAL (>=80)`);

  // --- Test 6: Determinism Test ---
  console.log('\nTest 6: Determinism Test (Identical Input Always Produces Identical Score)');
  const inputSample = {
    amount_paise: 799900,
    error_reason: 'gateway_error',
    prior_successful_payments_count: 2,
    created_at: new Date('2026-08-20T10:00:00Z'),
    attempt_count: 1
  };
  const runA = calculateRiskScore(inputSample);
  const runB = calculateRiskScore(inputSample);
  assert(runA.riskScore === runB.riskScore && runA.riskLevel === runB.riskLevel, 'Determinism verified: Run A === Run B');

  // --- Synthetic Dataset Risk Evaluation ---
  console.log('\n--- Evaluating Risk Engine Across Synthetic Dataset ---');
  const evalResult = await evaluateAllCasesRiskService();

  console.log(`\nProcessed ${evalResult.totalEvaluated} recovery cases.`);
  console.log('\n--- Risk Level Distribution Counts ---');
  console.table(evalResult.distribution);

  // Fetch 5 sample evaluated records from Database
  const sampleRes = await query(`
    SELECT 
      rc.id,
      t.razorpay_payment_id,
      c.name AS customer_name,
      rc.amount_at_risk_paise,
      pf.error_reason,
      rc.risk_score,
      rc.risk_level,
      rc.risk_reasons
    FROM recovery_cases rc
    LEFT JOIN customers c ON rc.customer_id = c.id
    LEFT JOIN payment_failures pf ON rc.payment_failure_id = pf.id
    LEFT JOIN transactions t ON pf.transaction_id = t.id
    ORDER BY rc.risk_score DESC
    LIMIT 5;
  `, []);

  const formattedSamples = sampleRes.rows.map(r => ({
    payment_id: r.razorpay_payment_id,
    customer: r.customer_name,
    amount: `₹${(parseInt(r.amount_at_risk_paise, 10) / 100).toLocaleString('en-IN')}`,
    error_reason: r.error_reason,
    risk_score: r.risk_score,
    risk_level: r.risk_level,
    top_reason: (typeof r.risk_reasons === 'string' ? JSON.parse(r.risk_reasons) : r.risk_reasons)[0]
  }));

  console.log('\n--- 5 Sample Evaluated Records ---');
  console.table(formattedSamples);

  // Verify all scores in DB are bounded 0 - 100
  const outOfBoundsCheck = await query(`
    SELECT COUNT(*) 
    FROM recovery_cases 
    WHERE risk_score < 0 OR risk_score > 100;
  `, []);
  const outOfBoundsCount = parseInt(outOfBoundsCheck.rows[0].count, 10);
  assert(outOfBoundsCount === 0, 'Verified: 100% of risk scores in database are bounded strictly between 0 and 100.');

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runRiskEngineTestSuite().catch(err => {
  console.error('[Risk Engine Test Error]', err);
  process.exit(1);
});
