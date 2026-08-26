import crypto from 'crypto';
import { processRazorpayWebhookService } from '../services/webhookService.js';
import { query } from '../db/index.js';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_webhook_secret';

function generateSignature(bodyString, secret = WEBHOOK_SECRET) {
  return crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
}

async function runPhase12WebhookTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 12 AUTOMATED TEST SUITE    ');
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

  // --- Test 1: Invalid Signature Rejection ---
  console.log('Test 1: Invalid Signature Rejection');
  const dummyPayload = { event: 'payment.captured', event_id: 'evt_test_bad_sig' };
  const rawBody1 = JSON.stringify(dummyPayload);
  try {
    await processRazorpayWebhookService({
      rawBody: Buffer.from(rawBody1),
      signature: 'invalid_hmac_signature',
      eventIdHeader: 'evt_test_bad_sig',
      body: dummyPayload
    });
    assert(false, 'Expected invalid signature to throw 400 error');
  } catch (err) {
    assert(err.statusCode === 400 && err.message.includes('Invalid Razorpay webhook signature'), 'Rejected invalid signature with 400 Bad Request');
  }

  // --- Test 2: Missing Event ID Rejection ---
  console.log('\nTest 2: Missing Event ID Rejection');
  const bodyNoEventId = { event: 'payment.captured' };
  const rawBody2 = JSON.stringify(bodyNoEventId);
  const sig2 = generateSignature(rawBody2);
  try {
    await processRazorpayWebhookService({
      rawBody: Buffer.from(rawBody2),
      signature: sig2,
      eventIdHeader: null,
      body: bodyNoEventId
    });
    assert(false, 'Expected missing event ID to throw 400 error');
  } catch (err) {
    assert(err.statusCode === 400 && err.message.includes('Missing Razorpay event ID'), 'Rejected request with missing event ID with 400 Bad Request');
  }

  // --- Test 3: Malformed Payload Rejection ---
  console.log('\nTest 3: Malformed Payload Rejection (Missing Event Name)');
  const malformedBody = { event_id: 'evt_test_malformed' };
  const rawBody3 = JSON.stringify(malformedBody);
  const sig3 = generateSignature(rawBody3);
  try {
    await processRazorpayWebhookService({
      rawBody: Buffer.from(rawBody3),
      signature: sig3,
      eventIdHeader: 'evt_test_malformed',
      body: malformedBody
    });
    assert(false, 'Expected malformed payload to throw 400 error');
  } catch (err) {
    assert(err.statusCode === 400 && err.message.includes('Malformed webhook payload'), 'Rejected malformed webhook payload with 400 Bad Request');
  }

  // --- Test 4: Amount Mismatch Protection ---
  console.log('\nTest 4: Amount Mismatch Protection');
  // Create a dummy case with amount 100000 paise
  const dummyCaseId = crypto.randomUUID();
  const dummyMerchantId = crypto.randomUUID();
  const dummyCustId = crypto.randomUUID();
  const dummyTxId = crypto.randomUUID();
  const dummyFailId = crypto.randomUUID();
  const dummyPlinkId = `plink_mismatch_${Date.now()}`;

  await query(`INSERT INTO merchants (id, name, email, razorpay_merchant_id) VALUES ($1, $2, $3, $4);`, [dummyMerchantId, 'Test Merchant', 'mismatch@test.com', `rzp_m_${Date.now()}`]);
  await query(`INSERT INTO customers (id, merchant_id, razorpay_customer_id, name, email) VALUES ($1, $2, $3, $4, $5);`, [dummyCustId, dummyMerchantId, `cust_${Date.now()}`, 'Mismatch User', 'mismatch@user.com']);
  await query(`INSERT INTO transactions (id, merchant_id, customer_id, razorpay_payment_id, razorpay_order_id, amount_paise, currency, method, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`, [dummyTxId, dummyMerchantId, dummyCustId, `pay_mismatch_${Date.now()}`, `order_${Date.now()}`, 100000, 'INR', 'upi', 'failed']);
  await query(`INSERT INTO payment_failures (id, merchant_id, transaction_id, event_id, error_code, error_reason, error_description) VALUES ($1, $2, $3, $4, $5, $6, $7);`, [dummyFailId, dummyMerchantId, dummyTxId, `evt_fail_${Date.now()}`, 'BAD_REQUEST', 'bank_timeout', 'Timeout']);
  await query(`INSERT INTO recovery_cases (id, merchant_id, customer_id, payment_failure_id, amount_at_risk_paise, status, recovery_link_id, recovery_link_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`, [dummyCaseId, dummyMerchantId, dummyCustId, dummyFailId, 100000, 'RECOVERING', dummyPlinkId, `https://rzp.io/i/test`]);

  // Send webhook with different amount: 50000 paise (Expected: 100000)
  const mismatchEventId = `evt_mismatch_${Date.now()}`;
  const mismatchPayload = {
    event: 'payment.captured',
    event_id: mismatchEventId,
    payload: {
      payment: {
        entity: {
          id: `pay_captured_${Date.now()}`,
          amount: 50000, // Mismatch!
          currency: 'INR',
          payment_link_id: dummyPlinkId
        }
      }
    }
  };
  const rawBody4 = JSON.stringify(mismatchPayload);
  const sig4 = generateSignature(rawBody4);

  const res4 = await processRazorpayWebhookService({
    rawBody: Buffer.from(rawBody4),
    signature: sig4,
    eventIdHeader: mismatchEventId,
    body: mismatchPayload
  });

  assert(res4.status === 'amount_mismatch', `Amount mismatch detected and handled (Got status: ${res4.status})`);
  
  // Verify case was NOT marked RECOVERED
  const mismatchCaseStatus = (await query(`SELECT status FROM recovery_cases WHERE id = $1;`, [dummyCaseId])).rows[0].status;
  assert(mismatchCaseStatus === 'RECOVERING', `Case status remained '${mismatchCaseStatus}' (NOT 'RECOVERED')`);

  // Verify Audit Log
  const auditRes = await query(`SELECT event_type FROM audit_logs WHERE recovery_case_id = $1 AND event_type = 'AMOUNT_MISMATCH_REJECTED';`, [dummyCaseId]);
  assert(auditRes.rows.length > 0, `Audit log 'AMOUNT_MISMATCH_REJECTED' created`);

  // --- Test 5: Idempotency Protection ---
  console.log('\nTest 5: Duplicate Webhook Event Protection');
  const dupEventId = `evt_dup_${Date.now()}`;
  const validCapturedPayload = {
    event: 'payment.captured',
    event_id: dupEventId,
    payload: {
      payment: {
        entity: {
          id: `pay_dup_${Date.now()}`,
          amount: 100000,
          currency: 'INR',
          payment_link_id: dummyPlinkId
        }
      }
    }
  };
  const rawBody5 = JSON.stringify(validCapturedPayload);
  const sig5 = generateSignature(rawBody5);

  // First Call: Success
  const firstCallRes = await processRazorpayWebhookService({
    rawBody: Buffer.from(rawBody5),
    signature: sig5,
    eventIdHeader: dupEventId,
    body: validCapturedPayload
  });
  assert(firstCallRes.status === 'success', `First webhook call processed successfully`);

  // Second Call with identical event_id: Duplicate Ignored
  const secondCallRes = await processRazorpayWebhookService({
    rawBody: Buffer.from(rawBody5),
    signature: sig5,
    eventIdHeader: dupEventId,
    body: validCapturedPayload
  });
  assert(secondCallRes.status === 'duplicate', `Duplicate webhook call detected and safely ignored (Got: ${secondCallRes.status})`);

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase12WebhookTestSuite().catch(err => {
  console.error('[Phase 12 Webhook Test Error]', err);
  process.exit(1);
});
