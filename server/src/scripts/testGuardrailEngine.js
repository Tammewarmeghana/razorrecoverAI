import { evaluateGuardrailRules, evaluateCaseGuardrailsService } from '../services/guardrailEngineService.js';
import { query } from '../db/index.js';

async function runGuardrailEngineTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 10 GUARDRAIL TEST SUITE    ');
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

  // Common dummy entities
  const baseMerchant = { max_retry_attempts: 3, max_contact_count: 2 };
  const baseCustomer = { is_opted_out: false };
  const baseTx = { amount_paise: 249900 };
  const baseCase = { status: 'DETECTED', attempt_count: 0, contact_count: 0, amount_at_risk_paise: 249900 };
  const baseDecision = { diagnosed_root_cause: 'TRANSIENT_BANK_OR_GATEWAY_FAILURE', chosen_strategy: 'SILENT_RETRY' };

  // --- Test 1: Normal SILENT_RETRY -> ALLOWED ---
  console.log('Test 1: Normal SILENT_RETRY (All limits & conditions satisfied)');
  const res1 = evaluateGuardrailRules({
    recoveryCase: baseCase,
    merchant: baseMerchant,
    customer: baseCustomer,
    transaction: baseTx,
    decision: baseDecision,
    proposedAction: 'SILENT_RETRY'
  });
  assert(res1.allowed === true, `Normal SILENT_RETRY is ALLOWED (Got: ${res1.allowed})`);
  assert(res1.final_action === 'SILENT_RETRY', `Final action is SILENT_RETRY`);

  // --- Test 2: Normal PAYMENT_LINK -> ALLOWED ---
  console.log('\nTest 2: Normal PAYMENT_LINK (All limits & conditions satisfied)');
  const res2 = evaluateGuardrailRules({
    recoveryCase: baseCase,
    merchant: baseMerchant,
    customer: baseCustomer,
    transaction: baseTx,
    decision: { diagnosed_root_cause: 'USER_ABANDONMENT', chosen_strategy: 'PAYMENT_LINK' },
    proposedAction: 'PAYMENT_LINK'
  });
  assert(res2.allowed === true, `Normal PAYMENT_LINK is ALLOWED (Got: ${res2.allowed})`);
  assert(res2.final_action === 'PAYMENT_LINK', `Final action is PAYMENT_LINK`);

  // --- Test 3: Already Recovered Case -> BLOCKED ---
  console.log('\nTest 3: Already Recovered Case (status: RECOVERED)');
  const res3 = evaluateGuardrailRules({
    recoveryCase: { ...baseCase, status: 'RECOVERED' },
    merchant: baseMerchant,
    customer: baseCustomer,
    transaction: baseTx,
    decision: baseDecision,
    proposedAction: 'SILENT_RETRY'
  });
  assert(res3.allowed === false, `Already recovered case is BLOCKED (Got: ${res3.allowed})`);
  assert(res3.reasons.includes('Payment has already been recovered.'), `Reason: 'Payment has already been recovered.'`);

  // --- Test 4: Retry Limit Reached -> BLOCKED ---
  console.log('\nTest 4: Retry Limit Reached (attempt_count: 3 >= max_retry_attempts: 3)');
  const res4 = evaluateGuardrailRules({
    recoveryCase: { ...baseCase, attempt_count: 3 },
    merchant: baseMerchant,
    customer: baseCustomer,
    transaction: baseTx,
    decision: baseDecision,
    proposedAction: 'SILENT_RETRY'
  });
  assert(res4.allowed === false, `SILENT_RETRY when retries exhausted is BLOCKED (Got: ${res4.allowed})`);
  assert(res4.reasons.includes('Maximum retry limit reached.'), `Reason: 'Maximum retry limit reached.'`);

  // --- Test 5: Contact Limit Reached -> BLOCKED ---
  console.log('\nTest 5: Contact Limit Reached (contact_count: 2 >= max_contact_count: 2)');
  const res5 = evaluateGuardrailRules({
    recoveryCase: { ...baseCase, contact_count: 2 },
    merchant: baseMerchant,
    customer: baseCustomer,
    transaction: baseTx,
    decision: { diagnosed_root_cause: 'USER_ABANDONMENT', chosen_strategy: 'PAYMENT_LINK' },
    proposedAction: 'PAYMENT_LINK'
  });
  assert(res5.allowed === false, `PAYMENT_LINK when contact limit reached is BLOCKED (Got: ${res5.allowed})`);
  assert(res5.reasons.includes('Maximum customer contact limit reached.'), `Reason: 'Maximum customer contact limit reached.'`);

  // --- Test 6: Customer Opted Out -> BLOCKED ---
  console.log('\nTest 6: Customer Opted Out (is_opted_out: true)');
  const res6 = evaluateGuardrailRules({
    recoveryCase: baseCase,
    merchant: baseMerchant,
    customer: { ...baseCustomer, is_opted_out: true },
    transaction: baseTx,
    decision: { diagnosed_root_cause: 'USER_ABANDONMENT', chosen_strategy: 'PAYMENT_LINK' },
    proposedAction: 'PAYMENT_LINK'
  });
  assert(res6.allowed === false, `Opted-out customer outreach is BLOCKED (Got: ${res6.allowed})`);
  assert(res6.reasons.includes('Customer has opted out of recovery communication.'), `Reason: 'Customer has opted out of recovery communication.'`);

  // --- Test 7: High-Value Transaction -> HUMAN_REVIEW ---
  console.log('\nTest 7: High-Value Transaction (₹18,000 >= ₹15,000)');
  const res7 = evaluateGuardrailRules({
    recoveryCase: { ...baseCase, amount_at_risk_paise: 1800000 },
    merchant: baseMerchant,
    customer: baseCustomer,
    transaction: { amount_paise: 1800000 },
    decision: baseDecision,
    proposedAction: 'SILENT_RETRY'
  });
  assert(res7.allowed === true, `High-value transaction is ALLOWED for review`);
  assert(res7.requires_human_approval === true, `requires_human_approval is true`);
  assert(res7.final_action === 'HUMAN_REVIEW', `final_action mapped to HUMAN_REVIEW`);
  assert(res7.reasons.includes('High-value recovery requires human approval.'), `Reason: 'High-value recovery requires human approval.'`);

  // --- Test 8: UNKNOWN Diagnosis -> HUMAN_REVIEW Required ---
  console.log('\nTest 8: UNKNOWN AI Diagnosis');
  const res8 = evaluateGuardrailRules({
    recoveryCase: baseCase,
    merchant: baseMerchant,
    customer: baseCustomer,
    transaction: baseTx,
    decision: { diagnosed_root_cause: 'UNKNOWN', chosen_strategy: 'HUMAN_REVIEW' },
    proposedAction: 'HUMAN_REVIEW'
  });
  assert(res8.allowed === false, `UNKNOWN diagnosis automatic execution is BLOCKED`);
  assert(res8.requires_human_approval === true, `requires_human_approval is true`);
  assert(res8.final_action === 'HUMAN_REVIEW', `final_action is HUMAN_REVIEW`);
  assert(res8.reasons.includes('Unknown diagnosis requires human review.'), `Reason: 'Unknown diagnosis requires human review.'`);

  // --- Test 9: Invalid Action -> BLOCKED ---
  console.log('\nTest 9: Invalid Proposed Action');
  const res9 = evaluateGuardrailRules({
    recoveryCase: baseCase,
    merchant: baseMerchant,
    customer: baseCustomer,
    transaction: baseTx,
    decision: baseDecision,
    proposedAction: 'INVALID_CUSTOM_ACTION'
  });
  assert(res9.allowed === false, `Invalid action is BLOCKED (Got: ${res9.allowed})`);
  assert(res9.reasons.some(r => r.includes('Invalid action')), `Reason correctly identifies invalid action`);

  // --- Test 10: Missing Recovery Case -> BLOCKED ---
  console.log('\nTest 10: Missing Recovery Case');
  const res10 = evaluateGuardrailRules({ recoveryCase: null });
  assert(res10.allowed === false, `Missing case is BLOCKED`);
  assert(res10.reasons.includes('Missing recovery case'), `Reason: 'Missing recovery case'`);

  // --- Test 11: Missing Required Data -> BLOCKED ---
  console.log('\nTest 11: Missing Required Data (Missing Customer)');
  const res11 = evaluateGuardrailRules({
    recoveryCase: baseCase,
    merchant: baseMerchant,
    customer: null, // Missing!
    transaction: baseTx,
    decision: baseDecision,
    proposedAction: 'SILENT_RETRY'
  });
  assert(res11.allowed === false, `Missing required data is BLOCKED`);
  assert(res11.reasons.some(r => r.includes('Missing required data')), `Reason identifies missing entity`);

  // --- Test 12: Zero Execution Safety Verification ---
  console.log('\nTest 12: Zero Action Execution Verification');
  const actionCountRes = await query(`SELECT COUNT(*) FROM recovery_actions;`, []);
  const count = parseInt(actionCountRes.rows[0].count, 10);
  assert(count === 0, `Verified: Zero recovery actions executed in recovery_actions table (Count: ${count})`);

  // --- Batch Evaluation on Synthetic Dataset ---
  console.log('\n--- Running Guardrail Engine Evaluation on 5 Real Synthetic Cases ---');
  const sampleCasesRes = await query(`
    SELECT id FROM recovery_cases ORDER BY created_at DESC LIMIT 5;
  `, []);

  const sampleGuardrailResults = [];
  for (let i = 0; i < sampleCasesRes.rows.length; i++) {
    const caseId = sampleCasesRes.rows[i].id;
    const guardRes = await evaluateCaseGuardrailsService(caseId);
    sampleGuardrailResults.push(guardRes);
  }

  console.log(`\nSuccessfully evaluated Guardrails for 5 synthetic cases.\n`);

  for (let i = 0; i < sampleGuardrailResults.length; i++) {
    const item = sampleGuardrailResults[i];
    console.log(`----------------------------------------------------------------------`);
    console.log(`Sample ${i + 1} [Case ID: ${item.recovery_case_id}]`);
    console.log(`----------------------------------------------------------------------`);
    console.log(`Proposed Action          : ${item.proposed_action}`);
    console.log(`Guardrail Decision       : ${item.guardrail_result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
    console.log(`Final Action             : ${item.guardrail_result.final_action}`);
    console.log(`Requires Human Approval  : ${item.guardrail_result.requires_human_approval}`);
    console.log(`Primary Reason           : ${item.guardrail_result.reasons[0]}`);
    console.log(`Checked Rules Summary    : [${item.guardrail_result.checked_rules.length} rules evaluated]`);
    console.log('');
  }

  // Verify Audit Log Audit Trail Insertion
  const auditRes = await query(`
    SELECT event_type, details 
    FROM audit_logs 
    WHERE event_type IN ('GUARDRAIL_PASSED', 'GUARDRAIL_BLOCKED')
    ORDER BY created_at DESC 
    LIMIT 3;
  `, []);
  assert(auditRes.rows.length > 0, `Verified: ${auditRes.rows.length} Guardrail audit log entries created in audit_logs table.`);

  console.log('Sample Audit Log Entries:');
  auditRes.rows.forEach((row, idx) => {
    const d = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
    console.log(`  Audit ${idx + 1} [${row.event_type}]: action='${d.proposed_action}', allowed=${d.allowed}, reason='${d.reasons[0]}'`);
  });

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runGuardrailEngineTestSuite().catch(err => {
  console.error('[Guardrail Engine Test Error]', err);
  process.exit(1);
});
