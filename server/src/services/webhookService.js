import crypto from 'crypto';
import { query } from '../db/index.js';
import { verifyWebhookSignature } from '../utils/webhookVerifier.js';
import { ApiError } from '../middleware/errorHandler.js';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'your_webhook_secret';

export const processRazorpayWebhookService = async ({ rawBody, signature, eventIdHeader, body }) => {
  // 1. Signature Verification
  const isValidSignature = verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET);
  if (!isValidSignature) {
    throw new ApiError('Invalid Razorpay webhook signature', 400);
  }

  // 2. Extract Event ID
  const eventId = eventIdHeader || body?.event_id || body?.contains?.event_id;
  if (!eventId) {
    throw new ApiError('Missing Razorpay event ID (x-razorpay-event-id header)', 400);
  }

  const eventName = body?.event;
  if (!eventName) {
    throw new ApiError('Malformed webhook payload: missing event name', 400);
  }

  // 3. Duplicate Webhook Protection (Idempotency Check)
  const existingFailCheck = await query(`
    SELECT id FROM payment_failures WHERE event_id = $1
    UNION ALL
    SELECT id FROM audit_logs WHERE details->>'event_id' = $1
    LIMIT 1;
  `, [eventId]);

  if (existingFailCheck.rows.length > 0) {
    console.log(`[Webhook Service] Duplicate event '${eventId}' ignored.`);
    return {
      status: 'duplicate',
      message: `Duplicate webhook event '${eventId}' safely ignored`,
      eventId
    };
  }

  // Fetch or Create Default Synthetic Merchant for Mapping
  const merchantRes = await query(`
    SELECT id FROM merchants LIMIT 1;
  `, []);

  let merchantId;
  if (merchantRes.rows.length > 0) {
    merchantId = merchantRes.rows[0].id;
  } else {
    merchantId = crypto.randomUUID();
    await query(`
      INSERT INTO merchants (id, name, email, razorpay_merchant_id)
      VALUES ($1, $2, $3, $4);
    `, [merchantId, 'Acme Store Demo', 'demo@synthetic.razorrecover.ai', 'acc_synthetic_demo']);
  }

  // 4. Handle Event Payload Types
  if (eventName === 'payment.failed') {
    return await handlePaymentFailed({ merchantId, eventId, payload: body });
  } else if (eventName === 'payment.captured' || eventName === 'payment.authorized') {
    return await handlePaymentCaptured({ merchantId, eventId, payload: body });
  } else {
    // Unknown or unhandled event
    console.log(`[Webhook Service] Unhandled event '${eventName}' received.`);
    const auditId = crypto.randomUUID();
    await query(`
      INSERT INTO audit_logs (id, merchant_id, event_type, details)
      VALUES ($1, $2, $3, $4::jsonb);
    `, [auditId, merchantId, 'WEBHOOK_EVENT_IGNORED', JSON.stringify({ event_id: eventId, event: eventName })]);

    return {
      status: 'ignored',
      message: `Event '${eventName}' acknowledged and logged`,
      eventId
    };
  }
};

// --- Handler for payment.failed Event ---
async function handlePaymentFailed({ merchantId, eventId, payload }) {
  const paymentEntity = payload?.payload?.payment?.entity;
  if (!paymentEntity) {
    throw new ApiError('Malformed webhook: missing payment entity in payload', 400);
  }

  const rzpPaymentId = paymentEntity.id;
  const rzpOrderId = paymentEntity.order_id || `order_${rzpPaymentId}`;
  const amountPaise = Math.round(Number(paymentEntity.amount || 0));
  const currency = paymentEntity.currency || 'INR';
  const method = paymentEntity.method || 'card';

  const errorCode = paymentEntity.error_code || 'GATEWAY_ERROR';
  const errorReason = paymentEntity.error_reason || 'payment_failed';
  const errorDesc = paymentEntity.error_description || 'Payment failed during processing';

  const customerName = paymentEntity.notes?.customer_name || paymentEntity.email || 'Valued Customer';
  const customerEmail = paymentEntity.email || 'customer@example.com';
  const customerPhone = paymentEntity.contact || '+919876543210';
  const rzpCustomerId = paymentEntity.customer_id || `cust_${rzpPaymentId}`;

  // Find or Create Customer
  let customerRes = await query(`
    SELECT id FROM customers WHERE merchant_id = $1 AND razorpay_customer_id = $2;
  `, [merchantId, rzpCustomerId]);

  let customerId;
  if (customerRes.rows.length > 0) {
    customerId = customerRes.rows[0].id;
  } else {
    customerId = crypto.randomUUID();
    await query(`
      INSERT INTO customers (id, merchant_id, razorpay_customer_id, name, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [customerId, merchantId, rzpCustomerId, customerName, customerEmail, customerPhone]);
  }

  // Create Transaction Record
  const txnId = crypto.randomUUID();
  await query(`
    INSERT INTO transactions (id, merchant_id, customer_id, razorpay_payment_id, razorpay_order_id, amount_paise, currency, method, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    ON CONFLICT (razorpay_payment_id) DO UPDATE SET status = 'failed';
  `, [txnId, merchantId, customerId, rzpPaymentId, rzpOrderId, amountPaise, currency, method, 'failed']);

  // Create Payment Failure Record
  const failureId = crypto.randomUUID();
  await query(`
    INSERT INTO payment_failures (id, merchant_id, transaction_id, event_id, error_code, error_reason, error_description, failed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP);
  `, [failureId, merchantId, txnId, eventId, errorCode, errorReason, errorDesc]);

  // Create Recovery Case (status = DETECTED)
  const caseId = crypto.randomUUID();
  await query(`
    INSERT INTO recovery_cases (id, merchant_id, customer_id, payment_failure_id, amount_at_risk_paise, amount_recovered_paise, status, attempt_count, contact_count, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  `, [caseId, merchantId, customerId, failureId, amountPaise, 0, 'DETECTED', 0, 0]);

  // Create Audit Log
  const auditId = crypto.randomUUID();
  await query(`
    INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
    VALUES ($1, $2, $3, $4, $5::jsonb);
  `, [
    auditId,
    merchantId,
    caseId,
    'WEBHOOK_PAYMENT_FAILED',
    JSON.stringify({ event_id: eventId, payment_id: rzpPaymentId, error_reason: errorReason, amount_paise: amountPaise })
  ]);

  return {
    status: 'success',
    event: 'payment.failed',
    recoveryCaseId: caseId,
    amountAtRiskPaise: amountPaise,
    eventId
  };
}

// --- Handler for payment.captured Event ---
async function handlePaymentCaptured({ merchantId, eventId, payload }) {
  const paymentEntity = payload?.payload?.payment?.entity;
  if (!paymentEntity) {
    throw new ApiError('Malformed webhook: missing payment entity in payload', 400);
  }

  const rzpPaymentId = paymentEntity.id;
  const rzpOrderId = paymentEntity.order_id || `order_${rzpPaymentId}`;
  const amountPaise = Math.round(Number(paymentEntity.amount || 0));
  const currency = paymentEntity.currency || 'INR';
  const method = paymentEntity.method || 'card';
  const rzpCustomerId = paymentEntity.customer_id;
  const paymentLinkId = paymentEntity.payment_link_id || payload?.payload?.payment_link?.entity?.id || paymentEntity.notes?.payment_link_id || paymentEntity.notes?.recovery_link_id;
  const caseIdFromNotes = paymentEntity.notes?.recovery_case_id || payload?.payload?.payment_link?.entity?.notes?.recovery_case_id;

  // Create or Update Transaction Record
  const txnId = crypto.randomUUID();
  await query(`
    INSERT INTO transactions (id, merchant_id, customer_id, razorpay_payment_id, razorpay_order_id, amount_paise, currency, method, status, created_at)
    VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    ON CONFLICT (razorpay_payment_id) DO UPDATE SET status = 'captured';
  `, [txnId, merchantId, rzpPaymentId, rzpOrderId, amountPaise, currency, method, 'captured']);

  // Find matching open Recovery Case for this payment link, customer, case ID from notes, or active RECOVERING case
  const openCaseRes = await query(`
    SELECT rc.id, rc.amount_at_risk_paise 
    FROM recovery_cases rc
    LEFT JOIN customers c ON rc.customer_id = c.id
    WHERE rc.status IN ('DETECTED', 'RECOVERING')
      AND (
        rc.id::text = $1
        OR (rc.recovery_link_id = $2 AND $2 != '')
        OR (c.razorpay_customer_id = $3 AND $3 != '')
        OR (c.email = $4 AND $4 != '')
        OR rc.status = 'RECOVERING'
      )
    ORDER BY rc.created_at DESC
    LIMIT 1;
  `, [caseIdFromNotes || '', paymentLinkId || '', rzpCustomerId || '', paymentEntity.email || '']);

  let updatedCaseId = null;

  if (openCaseRes.rows.length > 0) {
    const targetCase = openCaseRes.rows[0];
    const expectedAmountPaise = Number(targetCase.amount_at_risk_paise);

    // Amount Validation Safeguard: Captured amount MUST match expected recovery amount
    if (amountPaise !== expectedAmountPaise) {
      console.warn(`[Webhook Service] Amount mismatch for case '${targetCase.id}': expected ${expectedAmountPaise} paise, got ${amountPaise} paise.`);
      
      const mismatchAuditId = crypto.randomUUID();
      await query(`
        INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
        VALUES ($1, $2, $3, $4, $5::jsonb);
      `, [
        mismatchAuditId,
        merchantId,
        targetCase.id,
        'AMOUNT_MISMATCH_REJECTED',
        JSON.stringify({ event_id: eventId, expected_paise: expectedAmountPaise, received_paise: amountPaise })
      ]);

      return {
        status: 'amount_mismatch',
        message: `Captured amount ${amountPaise} does not match expected amount ${expectedAmountPaise}`,
        eventId
      };
    }

    updatedCaseId = targetCase.id;
    await query(`
      UPDATE recovery_cases
      SET 
        status = 'RECOVERED',
        amount_recovered_paise = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [amountPaise, updatedCaseId]);

    // Log REVENUE_RECOVERED audit event
    const revAuditId = crypto.randomUUID();
    await query(`
      INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
      VALUES ($1, $2, $3, $4, $5::jsonb);
    `, [
      revAuditId,
      merchantId,
      updatedCaseId,
      'REVENUE_RECOVERED',
      JSON.stringify({
        event_id: eventId,
        payment_id: rzpPaymentId,
        amount_recovered_paise: amountPaise,
        recovered_at: new Date().toISOString()
      })
    ]);

    console.log(`[Webhook Service] Recovery Case '${updatedCaseId}' successfully marked as RECOVERED (Amount: ₹${(amountPaise / 100).toFixed(2)})`);
  }

  // Create Webhook Payment Captured Log
  const auditId = crypto.randomUUID();
  await query(`
    INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
    VALUES ($1, $2, $3, $4, $5::jsonb);
  `, [
    auditId,
    merchantId,
    updatedCaseId,
    'WEBHOOK_PAYMENT_CAPTURED',
    JSON.stringify({ event_id: eventId, payment_id: rzpPaymentId, amount_recovered_paise: amountPaise, recovery_case_id: updatedCaseId })
  ]);

  return {
    status: 'success',
    event: 'payment.captured',
    recoveredCaseId: updatedCaseId,
    amountRecoveredPaise: amountPaise,
    eventId
  };
}
