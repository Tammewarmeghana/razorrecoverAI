import { calculateRecoveryDecision, makeRecoveryDecisionService } from '../services/decisionEngineService.js';
import { query } from '../db/index.js';

async function runDecisionEngineTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 9 DECISION ENGINE TEST SUITE');
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

  // --- Test 1: Temporary Bank Failure -> SILENT_RETRY ---
  console.log('Test 1: Temporary Bank Failure Input');
  const res1 = calculateRecoveryDecision({
    caseStatus: 'DETECTED',
    amountPaise: 249900,
    attemptCount: 0,
    maxRetryAttempts: 3,
    riskScore: 100,
    riskLevel: 'CRITICAL',
    aiDiagnosis: 'TRANSIENT_BANK_OR_GATEWAY_FAILURE',
    aiRecommendation: 'SILENT_RETRY',
    aiConfidence: 0.95
  });
  assert(res1.final_action === 'SILENT_RETRY', `Final action is SILENT_RETRY (Got: ${res1.final_action})`);
  assert(res1.requires_human_approval === false, `requires_human_approval is false (Got: ${res1.requires_human_approval})`);

  // --- Test 2: OTP Abandonment -> PAYMENT_LINK ---
  console.log('\nTest 2: OTP Abandonment Input');
  const res2 = calculateRecoveryDecision({
    caseStatus: 'DETECTED',
    amountPaise: 149900,
    attemptCount: 0,
    maxRetryAttempts: 3,
    riskScore: 68,
    riskLevel: 'HIGH',
    aiDiagnosis: 'USER_ABANDONMENT',
    aiRecommendation: 'PAYMENT_LINK',
    aiConfidence: 0.90
  });
  assert(res2.final_action === 'PAYMENT_LINK', `Final action is PAYMENT_LINK (Got: ${res2.final_action})`);
  assert(res2.requires_human_approval === false, `requires_human_approval is false`);

  // --- Test 3: Insufficient Funds -> CUSTOMER_REMINDER ---
  console.log('\nTest 3: Insufficient Funds Input (Standard Value)');
  const res3 = calculateRecoveryDecision({
    caseStatus: 'DETECTED',
    amountPaise: 499900,
    attemptCount: 1,
    maxRetryAttempts: 3,
    riskScore: 55,
    riskLevel: 'MEDIUM',
    aiDiagnosis: 'INSUFFICIENT_FUNDS',
    aiRecommendation: 'CUSTOMER_REMINDER',
    aiConfidence: 0.85
  });
  assert(res3.final_action === 'CUSTOMER_REMINDER', `Final action is CUSTOMER_REMINDER (Got: ${res3.final_action})`);
  assert(res3.requires_human_approval === false, `requires_human_approval is false`);

  // --- Test 4: Expired Card -> PAYMENT_LINK ---
  console.log('\nTest 4: Expired Card Input');
  const res4 = calculateRecoveryDecision({
    caseStatus: 'DETECTED',
    amountPaise: 99900,
    attemptCount: 2,
    maxRetryAttempts: 3,
    riskScore: 28,
    riskLevel: 'LOW',
    aiDiagnosis: 'EXPIRED_CARD',
    aiRecommendation: 'PAYMENT_LINK',
    aiConfidence: 0.92
  });
  assert(res4.final_action === 'PAYMENT_LINK', `Final action is PAYMENT_LINK (Got: ${res4.final_action})`);
  assert(res4.requires_human_approval === false, `requires_human_approval is false`);

  // --- Test 5: Unknown Diagnosis -> HUMAN_REVIEW ---
  console.log('\nTest 5: Unknown Diagnosis Input');
  const res5 = calculateRecoveryDecision({
    caseStatus: 'DETECTED',
    amountPaise: 50000,
    attemptCount: 0,
    maxRetryAttempts: 3,
    riskScore: 30,
    riskLevel: 'LOW',
    aiDiagnosis: 'UNKNOWN',
    aiRecommendation: 'NO_ACTION',
    aiConfidence: 0.40
  });
  assert(res5.final_action === 'HUMAN_REVIEW', `Final action is HUMAN_REVIEW (Got: ${res5.final_action})`);
  assert(res5.requires_human_approval === true, `requires_human_approval is true (Got: ${res5.requires_human_approval})`);

  // --- Test 6: Mismatched / Invalid AI Recommendation Safeguard ---
  console.log('\nTest 6: Mismatched AI Recommendation Safeguard (AI suggests SILENT_RETRY for Expired Card)');
  const res6 = calculateRecoveryDecision({
    caseStatus: 'DETECTED',
    amountPaise: 99900,
    attemptCount: 0,
    maxRetryAttempts: 3,
    riskScore: 40,
    riskLevel: 'MEDIUM',
    aiDiagnosis: 'EXPIRED_CARD',
    aiRecommendation: 'SILENT_RETRY', // Mismatch! Retrying an expired card won't work
    aiConfidence: 0.85
  });
  assert(res6.final_action === 'PAYMENT_LINK', `Decision engine safely overrides AI mismatch to PAYMENT_LINK (Got: ${res6.final_action})`);

  // --- Test 7: High-Value Ambiguous Case -> HUMAN_REVIEW ---
  console.log('\nTest 7: High-Value Case (₹18,000 >= ₹15,000)');
  const res7 = calculateRecoveryDecision({
    caseStatus: 'DETECTED',
    amountPaise: 1800000, // ₹18,000
    attemptCount: 0,
    maxRetryAttempts: 3,
    riskScore: 100,
    riskLevel: 'CRITICAL',
    aiDiagnosis: 'TRANSIENT_BANK_OR_GATEWAY_FAILURE',
    aiRecommendation: 'SILENT_RETRY',
    aiConfidence: 0.95
  });
  assert(res7.final_action === 'HUMAN_REVIEW', `High-value case (>₹15,000) routed to HUMAN_REVIEW (Got: ${res7.final_action})`);
  assert(res7.requires_human_approval === true, `requires_human_approval set to true for high-value case`);

  // --- Test 8: Already Recovered Case -> NO_ACTION ---
  console.log('\nTest 8: Already Recovered Case Input');
  const res8 = calculateRecoveryDecision({
    caseStatus: 'RECOVERED',
    amountPaise: 249900,
    attemptCount: 1,
    maxRetryAttempts: 3,
    riskScore: 100,
    riskLevel: 'CRITICAL',
    aiDiagnosis: 'TRANSIENT_BANK_OR_GATEWAY_FAILURE',
    aiRecommendation: 'SILENT_RETRY',
    aiConfidence: 0.95
  });
  assert(res8.final_action === 'NO_ACTION', `Completed case status produces NO_ACTION (Got: ${res8.final_action})`);
  assert(res8.requires_human_approval === false, `requires_human_approval is false for completed case`);

  // --- Test 9: Zero Execution Safety Verification ---
  console.log('\nTest 9: Zero Action Execution Verification');
  const initialActionsRes = await query(`SELECT COUNT(*) FROM recovery_actions;`, []);
  const initialCount = parseInt(initialActionsRes.rows[0].count, 10);
  assert(initialCount === 0, `Verified: Zero recovery actions executed in recovery_actions table (Count: ${initialCount})`);

  // --- Batch Run: Decision Engine on 5 Synthetic Recovery Cases ---
  console.log('\n--- Running Decision Engine on 5 Real Synthetic Recovery Cases ---');
  const sampleCasesRes = await query(`
    SELECT id FROM recovery_cases ORDER BY created_at DESC LIMIT 5;
  `, []);

  const sampleResults = [];
  for (let i = 0; i < sampleCasesRes.rows.length; i++) {
    const caseId = sampleCasesRes.rows[i].id;
    const decRes = await makeRecoveryDecisionService(caseId);
    sampleResults.push(decRes);
  }

  console.log(`\nSuccessfully evaluated decisions for 5 synthetic cases.\n`);

  for (let i = 0; i < sampleResults.length; i++) {
    const item = sampleResults[i];
    console.log(`----------------------------------------------------------------------`);
    console.log(`Sample ${i + 1} [Case ID: ${item.recovery_case_id}]`);
    console.log(`----------------------------------------------------------------------`);
    console.log(`Risk Score               : ${item.risk_summary.score} (${item.risk_summary.level})`);
    console.log(`AI Diagnosis             : ${item.ai_diagnosis_summary.diagnosis}`);
    console.log(`AI Recommended           : ${item.ai_diagnosis_summary.ai_recommendation}`);
    console.log(`FINAL DECISION ACTION    : ${item.final_decision.final_action}`);
    console.log(`Reason                   : ${item.final_decision.reason}`);
    console.log(`Requires Human Approval  : ${item.final_decision.requires_human_approval}`);
    console.log('');
  }

  console.log('======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runDecisionEngineTestSuite().catch(err => {
  console.error('[Decision Engine Test Error]', err);
  process.exit(1);
});
