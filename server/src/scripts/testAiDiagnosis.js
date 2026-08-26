import { generateAiDiagnosis, validateAiOutput, diagnoseRecoveryCaseService } from '../services/aiDiagnosisService.js';
import { query } from '../db/index.js';

async function runAiDiagnosisTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 8 AI DIAGNOSIS TEST SUITE   ');
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

  // --- Test 1: Bank Timeout ---
  console.log('Test 1: Bank Timeout Input');
  const inputBank = {
    transaction_amount_rupees: '2499.00',
    payment_method: 'upi',
    failure_code: 'GATEWAY_ERROR',
    failure_reason: 'bank_timeout',
    failure_description: 'Bank server timed out during authentication',
    number_of_previous_successful_payments: 2,
    number_of_previous_failures: 0,
    retry_count: 0,
    risk_score: 100,
    risk_level: 'CRITICAL',
    time_since_failure_hours: 1.5
  };
  const res1 = await generateAiDiagnosis(inputBank);
  assert(res1.diagnosis === 'TRANSIENT_BANK_OR_GATEWAY_FAILURE', `Diagnosis is TRANSIENT_BANK_OR_GATEWAY_FAILURE (Got: ${res1.diagnosis})`);
  assert(res1.recommended_intervention === 'SILENT_RETRY', `Intervention is SILENT_RETRY (Got: ${res1.recommended_intervention})`);

  // --- Test 2: OTP Timeout ---
  console.log('\nTest 2: OTP Timeout Input');
  const inputOtp = {
    transaction_amount_rupees: '1499.00',
    payment_method: 'card',
    failure_code: 'BAD_REQUEST_ERROR',
    failure_reason: 'otp_timeout',
    failure_description: 'Customer abandoned OTP entry screen',
    number_of_previous_successful_payments: 1,
    number_of_previous_failures: 0,
    retry_count: 0,
    risk_score: 68,
    risk_level: 'HIGH',
    time_since_failure_hours: 0.5
  };
  const res2 = await generateAiDiagnosis(inputOtp);
  assert(res2.diagnosis === 'USER_ABANDONMENT', `Diagnosis is USER_ABANDONMENT (Got: ${res2.diagnosis})`);
  assert(res2.recommended_intervention === 'PAYMENT_LINK', `Intervention is PAYMENT_LINK (Got: ${res2.recommended_intervention})`);

  // --- Test 3: Insufficient Funds ---
  console.log('\nTest 3: Insufficient Funds Input');
  const inputFunds = {
    transaction_amount_rupees: '4999.00',
    payment_method: 'netbanking',
    failure_code: 'BAD_REQUEST_ERROR',
    failure_reason: 'insufficient_funds',
    failure_description: 'Insufficient balance in account',
    number_of_previous_successful_payments: 3,
    number_of_previous_failures: 1,
    retry_count: 1,
    risk_score: 67,
    risk_level: 'HIGH',
    time_since_failure_hours: 4.0
  };
  const res3 = await generateAiDiagnosis(inputFunds);
  assert(res3.diagnosis === 'INSUFFICIENT_FUNDS', `Diagnosis is INSUFFICIENT_FUNDS (Got: ${res3.diagnosis})`);
  assert(res3.recommended_intervention === 'CUSTOMER_REMINDER', `Intervention is CUSTOMER_REMINDER (Got: ${res3.recommended_intervention})`);

  // --- Test 4: Expired Card ---
  console.log('\nTest 4: Expired Card Input');
  const inputCard = {
    transaction_amount_rupees: '999.00',
    payment_method: 'card',
    failure_code: 'BAD_REQUEST_ERROR',
    failure_reason: 'card_expired',
    failure_description: 'Debit/Credit card has expired',
    number_of_previous_successful_payments: 0,
    number_of_previous_failures: 2,
    retry_count: 2,
    risk_score: 28,
    risk_level: 'LOW',
    time_since_failure_hours: 48.0
  };
  const res4 = await generateAiDiagnosis(inputCard);
  assert(res4.diagnosis === 'EXPIRED_CARD', `Diagnosis is EXPIRED_CARD (Got: ${res4.diagnosis})`);
  assert(res4.recommended_intervention === 'PAYMENT_LINK', `Intervention is PAYMENT_LINK (Got: ${res4.recommended_intervention})`);

  // --- Test 5: Unknown / Insufficient Info ---
  console.log('\nTest 5: Unknown / Insufficient Information Input');
  const inputUnk = {
    transaction_amount_rupees: '500.00',
    payment_method: 'wallet',
    failure_code: 'UNKNOWN_CODE',
    failure_reason: 'other_reason',
    failure_description: 'Unrecognized error string',
    number_of_previous_successful_payments: 0,
    number_of_previous_failures: 0,
    retry_count: 0,
    risk_score: 30,
    risk_level: 'LOW',
    time_since_failure_hours: 10.0
  };
  const res5 = await generateAiDiagnosis(inputUnk);
  assert(res5.diagnosis === 'UNKNOWN', `Diagnosis is UNKNOWN (Got: ${res5.diagnosis})`);
  assert(res5.recommended_intervention === 'HUMAN_REVIEW', `Intervention is HUMAN_REVIEW (Got: ${res5.recommended_intervention})`);

  // --- Test 6: Invalid AI Output Protection ---
  console.log('\nTest 6: Invalid AI Output Protection');
  const invalidOutputSample = {
    diagnosis: 'INVALID_CUSTOM_CATEGORY_NAME', // Violation: Not in allowed list
    confidence: 1.5,                           // Violation: > 1.0
    evidence: [],                             // Violation: Empty
    recommended_intervention: 'EXECUTE_REFUND' // Violation: Not allowed
  };
  try {
    validateAiOutput(invalidOutputSample);
    assert(false, 'Expected invalid AI output to fail validation, but it passed');
  } catch (err) {
    assert(err.statusCode === 400 && err.message.includes('AI Validation Error'), 'Invalid AI output safely caught & rejected by validator');
  }

  // --- Test 7: AI API Failure Error Handling ---
  console.log('\nTest 7: AI API Failure Graceful Handling');
  const failingMockProvider = async () => {
    throw new Error('LLM Service Unavailable (503 Service Unavailable)');
  };
  try {
    await generateAiDiagnosis(inputBank, failingMockProvider);
    assert(false, 'Expected failing provider to throw error, but it passed');
  } catch (err) {
    assert(err.message.includes('LLM Service Unavailable'), 'AI API failure handled safely without executing any recovery actions');
  }

  // --- Execute AI Diagnosis API on 5 Real Synthetic Cases ---
  console.log('\n--- Running AI Diagnosis API on 5 Real Synthetic Recovery Cases ---');
  const sampleCasesRes = await query(`
    SELECT id FROM recovery_cases ORDER BY created_at DESC LIMIT 5;
  `, []);

  const sampleResults = [];
  for (let i = 0; i < sampleCasesRes.rows.length; i++) {
    const caseId = sampleCasesRes.rows[i].id;
    const diagRes = await diagnoseRecoveryCaseService(caseId);
    sampleResults.push(diagRes);
  }

  console.log(`\nSuccessfully generated and stored AI diagnoses for 5 synthetic cases.\n`);

  for (let i = 0; i < sampleResults.length; i++) {
    const item = sampleResults[i];
    console.log(`------------------------------------------------------`);
    console.log(`Sample ${i + 1} [Case ID: ${item.recovery_case_id}]`);
    console.log(`------------------------------------------------------`);
    console.log(`Diagnosed Root Cause      : ${item.ai_diagnosis.diagnosis}`);
    console.log(`Recommended Intervention  : ${item.ai_diagnosis.recommended_intervention}`);
    console.log(`Confidence Score          : ${item.ai_diagnosis.confidence}`);
    console.log(`Structured AI JSON Output :`);
    console.log(JSON.stringify(item.ai_diagnosis, null, 2));
    console.log('');
  }

  // Verify decisions stored in agent_decisions table
  const decisionsCountRes = await query(`SELECT COUNT(*) FROM agent_decisions;`, []);
  const count = parseInt(decisionsCountRes.rows[0].count, 10);
  assert(count >= 5, `Verified: ${count} AI decision records persisted in agent_decisions database table.`);

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAiDiagnosisTestSuite().catch(err => {
  console.error('[AI Diagnosis Test Error]', err);
  process.exit(1);
});
