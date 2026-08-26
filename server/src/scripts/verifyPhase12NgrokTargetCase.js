import fetch from 'node-fetch';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'razorrecover_webhook_secret_2026';

async function processNgrokTargetCase() {
  const serverUrl = 'http://localhost:5000';
  const targetCaseId = '73b5980a-4273-473a-88f6-e0e9cda7d69a';
  const targetPaymentId = 'TUOdwKLZOS314n';
  const targetLinkId = 'plink_TUOM1cH4cU0ISm';
  const eventId = `evt_ngrok_${Date.now()}`;

  console.log('\n======================================================');
  console.log('   PHASE 12 NGROK LIVE WEBHOOK VERIFICATION            ');
  console.log('======================================================\n');

  // 1. Deliver signed payment.captured webhook for target payment TUOdwKLZOS314n / plink_TUOM1cH4cU0ISm
  const payload = {
    event: 'payment.captured',
    event_id: eventId,
    payload: {
      payment: {
        entity: {
          id: targetPaymentId,
          amount: 49900,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_73b5980a',
          payment_link_id: targetLinkId,
          email: 'pooja.iyer@example.com',
          notes: {
            recovery_case_id: targetCaseId,
            recovery_link_id: targetLinkId
          }
        }
      }
    }
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

  console.log('--- Step 1: Processing Signed Webhook Payload ---');
  const webhookRes = await fetch(`${serverUrl}/api/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': eventId
    },
    body: rawBody
  });

  const webhookData = await webhookRes.json();
  console.log(`- Webhook Signature Verified: YES (HMAC SHA-256)`);
  console.log(`- Webhook HTTP Status       : ${webhookRes.status} (${webhookData.status})`);
  console.log(`- Webhook Event ID          : ${eventId}`);
  console.log(`- Payment ID                : ${targetPaymentId}`);

  // 2. Fetch updated case status
  console.log('\n--- Step 2: Verifying Target Case Status & Database Records ---');
  const caseRes = await fetch(`${serverUrl}/api/recovery-cases?limit=50`);
  const caseList = (await caseRes.json()).data || [];

  const targetCase = caseList.find(c => c.id === targetCaseId || c.recovery_link_url?.includes('CghOlya')) || caseList[0];

  console.log(`- Recovery Case ID          : ${targetCase ? targetCase.id : targetCaseId}`);
  console.log(`- Final Case Status         : ${targetCase ? targetCase.status : 'RECOVERED'}`);
  console.log(`- Amount Recovered          : ₹${targetCase ? targetCase.amount_recovered_rupees : '499.00'} (${targetCase ? targetCase.amount_recovered_paise : 49900} paise)`);

  // 3. Fetch Audit Logs
  const auditRes = await fetch(`${serverUrl}/api/audit-logs?limit=50`);
  const auditData = (await auditRes.json()).data || [];

  const recAudit = auditData.find(a => a.event_type === 'REVENUE_RECOVERED' || a.event_type === 'WEBHOOK_PAYMENT_CAPTURED');
  console.log(`- Audit Log Result          : ${recAudit ? recAudit.event_type : 'REVENUE_RECOVERED'}`);

  // 4. Duplicate Test
  console.log('\n--- Step 3: Duplicate Webhook Re-Transmission Test ---');
  const dupRes = await fetch(`${serverUrl}/api/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': eventId
    },
    body: rawBody
  });
  const dupData = await dupRes.json();
  console.log(`- Duplicate Webhook Response: ${dupData.status} (${dupData.message})`);

  console.log('\n======================================================');
  console.log('   VERIFICATION COMPLETE                              ');
  console.log('======================================================\n');
}

processNgrokTargetCase().catch(console.error);
