import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Controller for Merchant Policy Configuration Management
 */

export const getMerchantConfig = async (req, res, next) => {
  try {
    const merchantRes = await query(`SELECT * FROM merchants LIMIT 1;`, []);
    if (merchantRes.rows.length === 0) {
      throw new ApiError('Merchant profile not found', 404);
    }
    const merchant = merchantRes.rows[0];

    res.status(200).json({
      success: true,
      data: {
        merchant_id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        max_retry_attempts: parseInt(merchant.max_retry_attempts || 3, 10),
        max_contact_count: parseInt(merchant.max_contact_count || 2, 10),
        high_value_threshold_rupees: 15000,
        enable_payment_links: true,
        enable_silent_retries: true,
        enable_customer_reminders: true
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateMerchantConfig = async (req, res, next) => {
  try {
    const {
      max_retry_attempts = 3,
      max_contact_count = 2,
      high_value_threshold_rupees = 15000
    } = req.body || {};

    // Input Validation & Bounds Clamping
    const retryLimit = Math.max(1, Math.min(10, Number(max_retry_attempts)));
    const contactLimit = Math.max(1, Math.min(5, Number(max_contact_count)));
    const highValueRupees = Math.max(1000, Number(high_value_threshold_rupees));

    const merchantRes = await query(`SELECT id FROM merchants LIMIT 1;`, []);
    if (merchantRes.rows.length === 0) {
      throw new ApiError('Merchant profile not found', 404);
    }
    const merchantId = merchantRes.rows[0].id;

    const updateSql = `
      UPDATE merchants
      SET 
        max_retry_attempts = $1,
        max_contact_count = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;

    const updatedRes = await query(updateSql, [retryLimit, contactLimit, merchantId]);
    const updated = updatedRes.rows[0];

    res.status(200).json({
      success: true,
      message: 'Merchant policy configuration updated successfully',
      data: {
        merchant_id: updated.id,
        max_retry_attempts: parseInt(updated.max_retry_attempts, 10),
        max_contact_count: parseInt(updated.max_contact_count, 10),
        high_value_threshold_rupees: highValueRupees
      }
    });
  } catch (error) {
    next(error);
  }
};
