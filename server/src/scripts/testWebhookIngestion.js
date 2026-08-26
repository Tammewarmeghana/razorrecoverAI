import crypto from 'crypto';
import { processRazorpayWebhookService } from '../services/webhookService.js';
import { query } from '../db/index.js';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_webhook_secret';

function createSignature(payloadStr, secret = WEBHOOK_SECRET) {
  return crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(payloadStr, 'utf8'))
    .digest('hex');
}

async function runWebhookTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 6 WEBHOOK TEST SUITE       ');
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

  // --- Test Case 1: Valid Payment Failure Webhook (payment.failed) ---
  console.log('Test Case 1: Valid Payment Failure Webhook (payment.failed)');
  const eventId1 = `evt_test_fail_${Date.now()}`;
  const payload1Obj = {
    event: 'payment.failed',
    event_id: eventId1,
    payload: {
      payment: {
        entity: {
          id: `pay_test_fail_${Date.now()}`,
          order_id: `order_test_fail_${Date.now()}`,
          amount: 349900,
          currency: 'INR',
          status: 'failed',
          method: 'upi',
          error_code: 'GATEWAY_ERROR',
          error_reason: 'bank_timeout',
          error_description: 'Bank server timed out during authentication',
          customer_id: `cust_test_001`,
          email: 'priya.sharma@example.com',
          contact: '+919876543201'
        }
      }
    }
  };

  const payload1Str = JSON.stringify(payload1Obj);
  const signature1 = createSignature(payload1Str);

  try {
    const res1 = await processRazorpayWebhookService({
      rawBody: Buffer.from(payload1Str, 'utf8'),
      signature: signature1,
      eventIdHeader: eventId1,
      body: payload1Obj
    });

    assert(res1.status === 'success' && res1.event === 'payment.failed', 'Payment failure webhook processed successfully');
    assert(res1.amountAtRiskPaise === 349900, 'amount_at_risk_paise correctly recorded as 349900 paise (₹3,499)');

    // Verify DB recovery_case record
    const caseRes = await query(`SELECT status, amount_at_risk_paise FROM recovery_cases WHERE id = $1;`, [res1.recoveryCaseId]);
    assert(caseRes.rows.length > 0 && caseRes.rows[0].status === 'DETECTED', 'recovery_case status set to DETECTED in database');
  } catch (err) {
    assert(false, `Valid failure webhook threw error: ${err.message}`);
  }

  // --- Test Case 2: Invalid Signature ---
  console.log('\nTest Case 2: Invalid Signature Verification');
  try {
    await processRazorpayWebhookService({
      rawBody: Buffer.from(payload1Str, 'utf8'),
      signature: 'invalid_fake_signature_hex_string',
      eventIdHeader: 'evt_invalid_sig',
      body: payload1Obj
    });
    assert(false, 'Expected invalid signature to fail, but it passed');
  } catch (err) {
    assert(err.statusCode === 400 && err.message.includes('Invalid Razorpay webhook signature'), 'Rejected invalid signature with 400 Bad Request');
  }

  // --- Test Case 3: Duplicate Webhook Protection ---
  console.log('\nTest Case 3: Duplicate Webhook (Replaying Event ID)');
  try {
    const dupRes = await processRazorpayWebhookService({
      rawBody: Buffer.from(payload1Str, 'utf8'),
      signature: signature1,
      eventIdHeader: eventId1,
      body: payload1Obj
    });

    assert(dupRes.status === 'duplicate', 'Duplicate event ID detected and returned duplicate status');
    assert(dupRes.message.includes('safely ignored'), 'Duplicate webhook safely ignored without re-inserting records');
  } catch (err) {
    assert(false, `Duplicate webhook check threw error: ${err.message}`);
  }

  // --- Test Case 4: Malformed Webhook ---
  console.log('\nTest Case 4: Malformed Webhook Payload');
  const malformedObj = { event: 'payment.failed' }; // Missing payload.payment.entity
  const malformedStr = JSON.stringify(malformedObj);
  const malformedSig = createSignature(malformedStr);

  try {
    await processRazorpayWebhookService({
      rawBody: Buffer.from(malformedStr, 'utf8'),
      signature: malformedSig,
      eventIdHeader: 'evt_malformed_001',
      body: malformedObj
    });
    assert(false, 'Expected malformed payload to fail, but it passed');
  } catch (err) {
    assert(err.statusCode === 400 && err.message.includes('Malformed webhook'), 'Rejected malformed webhook payload with 400 Bad Request');
  }

  // --- Test Case 5: Successful Payment Webhook (payment.captured) ---
  console.log('\nTest Case 5: Successful Payment Webhook (payment.captured)');
  const eventId5 = `evt_test_cap_${Date.now()}`;
  const payload5Obj = {
    event: 'payment.captured',
    event_id: eventId5,
    payload: {
      payment: {
        entity: {
          id: `pay_test_cap_${Date.now()}`,
          order_id: `order_test_fail_${Date.now()}`,
          amount: 349900,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
          customer_id: `cust_test_001`,
          email: 'priya.sharma@example.com'
        }
      }
    }
  };

  const payload5Str = JSON.stringify(payload5Obj);
  const signature5 = createSignature(payload5Str);

  try {
    const res5 = await processRazorpayWebhookService({
      rawBody: Buffer.from(payload5Str, 'utf8'),
      signature: signature5,
      eventIdHeader: eventId5,
      body: payload5Obj
    });

    assert(res5.status === 'success' && res5.event === 'payment.captured', 'Payment captured webhook processed successfully');
    assert(res5.amountRecoveredPaise === 349900, 'amount_recovered_paise correctly recorded as 349900 paise (₹3,499)');

    if (res5.recoveredCaseId) {
      const caseRes = await query(`SELECT status, amount_recovered_paise FROM recovery_cases WHERE id = $1;`, [res5.recoveredCaseId]);
      assert(caseRes.rows[0].status === 'RECOVERED', 'recovery_case status updated to RECOVERED in database');
    } else {
      assert(true, 'Payment captured recorded as successful transaction');
    }
  } catch (err) {
    assert(false, `Payment captured webhook threw error: ${err.message}`);
  }

  // --- Test Case 6: Unknown Event ---
  console.log('\nTest Case 6: Unknown / Unhandled Webhook Event');
  const eventId6 = `evt_test_unk_${Date.now()}`;
  const payload6Obj = { event: 'order.paid', event_id: eventId6 };
  const payload6Str = JSON.stringify(payload6Obj);
  const signature6 = createSignature(payload6Str);

  try {
    const res6 = await processRazorpayWebhookService({
      rawBody: Buffer.from(payload6Str, 'utf8'),
      signature: signature6,
      eventIdHeader: eventId6,
      body: payload6Obj
    });

    assert(res6.status === 'ignored', 'Unknown event acknowledged safely with ignored status');
  } catch (err) {
    assert(false, `Unknown event threw error: ${err.message}`);
  }

  // --- Test Case 7: Missing Event ID ---
  console.log('\nTest Case 7: Missing Event ID');
  try {
    await processRazorpayWebhookService({
      rawBody: Buffer.from(payload1Str, 'utf8'),
      signature: signature1,
      eventIdHeader: null,
      body: { event: 'payment.failed', payload: {} }
    });
    assert(false, 'Expected missing event ID to fail, but it passed');
  } catch (err) {
    assert(err.statusCode === 400 && err.message.includes('Missing Razorpay event ID'), 'Rejected request with missing event ID with 400 Bad Request');
  }

  // --- Final Summary ---
  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runWebhookTestSuite().catch(err => {
  console.error('[Webhook Test Error]', err);
  process.exit(1);
});
