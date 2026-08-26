import { executePaymentLinkRecoveryService } from '../services/recoveryExecutionService.js';
import { query } from '../db/index.js';

async function runExecutionTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 11 EXECUTION TEST SUITE     ');
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

  // --- End-to-End Integration Verification Case ---
  console.log('--- Step 1: Select Synthetic Failed Case & Prepare Engine Pipeline ---');
  
  // Pick an active failed case from synthetic database
  const caseRes = await query(`
    SELECT rc.id, rc.status, rc.amount_at_risk_paise, c.name AS customer_name, c.is_opted_out
    FROM recovery_cases rc
    LEFT JOIN customers c ON rc.customer_id = c.id
    WHERE rc.status = 'DETECTED' AND rc.amount_at_risk_paise < 1500000 AND (c.is_opted_out IS FALSE OR c.is_opted_out IS NULL)
    ORDER BY rc.created_at DESC
    LIMIT 1;
  `, []);

  if (caseRes.rows.length === 0) {
    console.error('No suitable synthetic case found for test.');
    process.exit(1);
  }

  const testCase = caseRes.rows[0];
  const caseId = testCase.id;
  console.log(`Selected Case ID: ${caseId} (Customer: ${testCase.customer_name}, Amount: ₹${(testCase.amount_at_risk_paise / 100).toFixed(2)})`);

  // Mock Razorpay API for unit testing
  let rzpApiCallCount = 0;
  const mockRzpApiSuccess = async ({ amount_paise }) => {
    rzpApiCallCount++;
    return {
      id: `plink_test_mock_${Date.now()}`,
      short_url: `https://rzp.io/i/mock${Date.now()}`,
      amount: amount_paise,
      status: 'created'
    };
  };

  // --- Test 1: Valid PAYMENT_LINK Execution ---
  console.log('\nTest 1: Valid PAYMENT_LINK Decision + Guardrails Pass');
  const initialStatus = testCase.status;
  const res1 = await executePaymentLinkRecoveryService(caseId, mockRzpApiSuccess);

  assert(res1.success === true, `Execution returned success: true`);
  assert(res1.data.action === 'PAYMENT_LINK', `Action is PAYMENT_LINK`);
  assert(res1.data.status === 'SUCCESS', `Status is SUCCESS`);
  assert(res1.data.payment_link_id.startsWith('plink_'), `Payment Link ID created (${res1.data.payment_link_id})`);
  assert(res1.data.payment_link_url.includes('rzp.io'), `Payment Link URL generated`);
  assert(rzpApiCallCount === 1, `Razorpay API called exactly 1 time`);

  // Verify Case Status after Execution (Must NOT be RECOVERED)
  const caseAfterRes = await query(`SELECT status, recovery_link_id FROM recovery_cases WHERE id = $1;`, [caseId]);
  const statusAfter = caseAfterRes.rows[0].status;
  assert(statusAfter === 'RECOVERING', `Case status updated from '${initialStatus}' to '${statusAfter}' (NOT 'RECOVERED')`);

  // --- Test 2: Idempotency & Duplicate Link Protection ---
  console.log('\nTest 2: Duplicate Link Protection (Re-executing Same Case)');
  const rzpCallCountBeforeIdempotency = rzpApiCallCount;
  const res2 = await executePaymentLinkRecoveryService(caseId, mockRzpApiSuccess);

  assert(res2.success === true, `Duplicate request handled successfully`);
  assert(res2.is_duplicate_prevented === true, `is_duplicate_prevented flag is true`);
  assert(res2.data.payment_link_id === res1.data.payment_link_id, `Returned existing Payment Link ID without duplicate creation`);
  assert(rzpApiCallCount === rzpCallCountBeforeIdempotency, `Razorpay API was NOT called again (Call count remained ${rzpApiCallCount})`);

  // --- Test 3: Guardrail Blocked (Opted Out Customer) ---
  console.log('\nTest 3: Guardrail Blocked (Opted-Out Customer)');
  // Pick another case and set customer opted out
  const case2Res = await query(`SELECT id, customer_id FROM recovery_cases WHERE id != $1 LIMIT 1;`, [caseId]);
  const case2Id = case2Res.rows[0].id;
  await query(`UPDATE customers SET is_opted_out = true WHERE id = $1;`, [case2Res.rows[0].customer_id]);

  try {
    await executePaymentLinkRecoveryService(case2Id, mockRzpApiSuccess);
    assert(false, 'Expected execution to be blocked for opted-out customer');
  } catch (err) {
    assert(err.message.includes('Execution Blocked by Guardrail') || err.message.includes('opted out'), `Guardrail blocked opted-out customer cleanly (${err.message})`);
  }

  // --- Test 4: Guardrail Blocked (High-Value Human Approval Required) ---
  console.log('\nTest 4: High-Value Case Requiring Human Approval');
  const case3Res = await query(`SELECT id FROM recovery_cases WHERE id != $1 AND id != $2 LIMIT 1;`, [caseId, case2Id]);
  const case3Id = case3Res.rows[0].id;
  await query(`UPDATE recovery_cases SET amount_at_risk_paise = 1800000 WHERE id = $1;`, [case3Id]);

  try {
    await executePaymentLinkRecoveryService(case3Id, mockRzpApiSuccess);
    assert(false, 'Expected high-value case execution to be blocked for human approval');
  } catch (err) {
    assert(err.message.includes('human approval') || err.message.includes('High-value'), `High-value case safely blocked for human approval (${err.message})`);
  }

  // --- Test 5: Already Recovered Case -> Execution Blocked ---
  console.log('\nTest 5: Already Recovered Case Execution Protection');
  const case4Res = await query(`SELECT id FROM recovery_cases WHERE id != $1 AND id != $2 AND id != $3 LIMIT 1;`, [caseId, case2Id, case3Id]);
  const case4Id = case4Res.rows[0].id;
  await query(`UPDATE recovery_cases SET status = 'RECOVERED' WHERE id = $1;`, [case4Id]);

  try {
    await executePaymentLinkRecoveryService(case4Id, mockRzpApiSuccess);
    assert(false, 'Expected already recovered case to be blocked');
  } catch (err) {
    assert(err.message.includes('already been recovered') || err.message.includes('Blocked'), `Already recovered case safely blocked from execution`);
  }

  // --- Test 6: Razorpay API Failure Handling ---
  console.log('\nTest 6: Razorpay API Failure Handling');
  const case5Res = await query(`SELECT id FROM recovery_cases WHERE id != $1 AND id != $2 AND id != $3 AND id != $4 LIMIT 1;`, [caseId, case2Id, case3Id, case4Id]);
  const case5Id = case5Res.rows[0].id;
  
  const mockFailingApi = async () => {
    throw new Error('Razorpay Gateway Timeout (504 Gateway Timeout)');
  };

  try {
    await executePaymentLinkRecoveryService(case5Id, mockFailingApi);
    assert(false, 'Expected failing Razorpay call to throw error');
  } catch (err) {
    assert(err.message.includes('Razorpay Payment Link Creation Failed'), `API failure caught safely`);
    
    // Verify action status in DB
    const failedActionRes = await query(`
      SELECT status FROM recovery_actions WHERE recovery_case_id = $1 ORDER BY executed_at DESC LIMIT 1;
    `, [case5Id]);
    assert(failedActionRes.rows[0].status === 'FAILED', `recovery_actions record updated to status 'FAILED'`);

    // Verify recovery case was NOT marked RECOVERED
    const c5Status = (await query(`SELECT status FROM recovery_cases WHERE id = $1;`, [case5Id])).rows[0].status;
    assert(c5Status !== 'RECOVERED', `Recovery case remains '${c5Status}' (NOT 'RECOVERED')`);
  }

  // --- Test 7: Secret Credential Leak Protection ---
  console.log('\nTest 7: Secret Credential Leak Protection');
  const responseJson = JSON.stringify(res1);
  assert(!responseJson.includes('secret') && !responseJson.includes('key_secret'), `Verified: Secret credentials (RAZORPAY_KEY_SECRET) never appear in API responses`);

  // --- Print Database Records for End-to-End Verification ---
  console.log('\n--- End-to-End Verification Output ---');
  const finalActionRecord = await query(`
    SELECT id, recovery_case_id, action_type, status, response_data, executed_at 
    FROM recovery_actions 
    WHERE recovery_case_id = $1 AND status = 'SUCCESS'
    ORDER BY executed_at DESC LIMIT 1;
  `, [caseId]);

  console.log('Persisted recovery_actions Database Record:');
  console.table(finalActionRecord.rows);

  console.log('======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runExecutionTestSuite().catch(err => {
  console.error('[Execution Engine Test Error]', err);
  process.exit(1);
});
