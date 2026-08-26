import crypto from 'crypto';

/**
 * Validates Razorpay Webhook Signature according to official docs:
 * HMAC-SHA256(rawBody, webhookSecret) === signature
 */
export const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (err) {
    console.error('[Webhook Verifier Error]', err.message);
    return false;
  }
};
