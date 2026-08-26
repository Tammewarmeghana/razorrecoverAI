import { processRazorpayWebhookService } from '../services/webhookService.js';

export const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const eventIdHeader = req.headers['x-razorpay-event-id'];
    const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const body = req.body;

    const result = await processRazorpayWebhookService({
      rawBody,
      signature,
      eventIdHeader,
      body
    });

    res.status(200).json({
      success: true,
      message: result.message || 'Webhook processed successfully',
      event: result.event,
      eventId: result.eventId,
      status: result.status,
      recoveryCaseId: result.recoveryCaseId || result.recoveredCaseId || null
    });
  } catch (err) {
    next(err);
  }
};
