import { razorpayInstance, isConfigured } from '../config/razorpay.js';
import { query } from '../db/index.js';

/**
 * Official Razorpay Integration Service (TEST MODE ONLY)
 * Connects directly to official Razorpay Payment Links API.
 * Fake URL fallbacks are completely removed.
 */

export const createPaymentLinkService = async ({
  amount_paise,
  currency = 'INR',
  description = 'RazorRecover AI Revenue Recovery',
  customer,
  notes = {},
  callback_url
}) => {
  if (!isConfigured) {
    throw new Error('Razorpay API Configuration Error: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are missing or unconfigured in server/.env');
  }

  const payload = {
    amount: Math.round(Number(amount_paise)),
    currency: currency || 'INR',
    accept_partial: false,
    description: description,
    customer: customer ? {
      name: customer.name || 'Valued Customer',
      email: customer.email || 'customer@example.com',
      contact: customer.phone || '+919876543210'
    } : undefined,
    notify: {
      sms: false,
      email: true
    },
    reminder_enable: true,
    notes: {
      source: 'RazorRecover_AI',
      ...notes
    },
    ...(callback_url ? { callback_url, callback_method: 'get' } : {})
  };

  try {
    console.log('[Razorpay API] Creating Payment Link via Official SDK (TEST MODE)...');
    const linkResponse = await razorpayInstance.paymentLink.create(payload);
    
    if (!linkResponse || !linkResponse.id || !linkResponse.short_url) {
      throw new Error('Razorpay API returned an invalid response missing id or short_url.');
    }

    return linkResponse;
  } catch (error) {
    console.error('[Razorpay API Error] Payment Link Creation Failed:', error.message);
    throw new Error(`Razorpay API Error: ${error.message}`);
  }
};

export const fetchPaymentLinkService = async (paymentLinkId) => {
  if (!isConfigured) {
    throw new Error('Razorpay API Configuration Error: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are missing or unconfigured in server/.env');
  }

  try {
    console.log(`[Razorpay API] Fetching Payment Link '${paymentLinkId}'...`);
    const response = await razorpayInstance.paymentLink.fetch(paymentLinkId);
    return response;
  } catch (error) {
    console.error(`[Razorpay API Error] Fetch Payment Link Failed for '${paymentLinkId}':`, error.message);
    throw new Error(`Razorpay API Error: ${error.message}`);
  }
};

export const storePaymentLinkInRecoveryCaseService = async ({ recoveryCaseId, paymentLinkId, shortUrl }) => {
  const sql = `
    UPDATE recovery_cases
    SET 
      recovery_link_id = $1,
      recovery_link_url = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, status, amount_at_risk_paise, recovery_link_id, recovery_link_url, updated_at;
  `;

  const res = await query(sql, [paymentLinkId, shortUrl, recoveryCaseId]);

  if (res.rows.length === 0) {
    throw new Error(`Recovery case with ID '${recoveryCaseId}' not found.`);
  }

  return res.rows[0];
};
