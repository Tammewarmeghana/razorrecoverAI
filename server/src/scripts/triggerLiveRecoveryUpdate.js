import crypto from 'crypto';
import fetch from 'node-fetch';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'razorrecover_webhook_secret_2026';

async function triggerWebhook() {
  const eventId = `evt_live_rec_${Date.now()}`;
  const paymentId = `pay_TUPPPZSa993CV9`;
  const amountPaise = 49900;

  const payload = {
    event: 'payment.captured',
    event_id: eventId,
    payload: {
      payment: {
        entity: {
          id: paymentId,
          amount: amountPaise,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_885c2d9a',
          email: 'pooja.iyer@example.com',
          payment_link_id: 'plink_TUPO6CmnAe1UBJ',
          notes: {
            recovery_case_id: '885c2d9a-f922-47d0-9f85-c4697ff6da03'
          }
        }
      }
    }
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

  console.log('\n--- Delivering Live Razorpay payment.captured Webhook ---');
  const res = await fetch('http://localhost:5000/api/webhooks/razorpay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': eventId
    },
    body: rawBody
  });

  const data = await res.json();
  console.log('Webhook Response:', data);
}

triggerWebhook().catch(console.error);
