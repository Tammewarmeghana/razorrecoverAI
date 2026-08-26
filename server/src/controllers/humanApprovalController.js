import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { executePaymentLinkRecoveryService } from '../services/recoveryExecutionService.js';
import crypto from 'crypto';

/**
 * Human Approval Controller for Manager Override & High-Value Approval Queue
 */

export const approveCaseRecovery = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Load Recovery Case
    const caseRes = await query(`SELECT * FROM recovery_cases WHERE id = $1;`, [id]);
    if (caseRes.rows.length === 0) {
      throw new ApiError(`Recovery Case with ID '${id}' not found`, 404);
    }
    const recoveryCase = caseRes.rows[0];

    if (recoveryCase.status === 'RECOVERED') {
      throw new ApiError(`Recovery Case '${id}' has already been recovered.`, 400);
    }

    // Log Human Approval Granted Audit Log
    const auditId = crypto.randomUUID();
    await query(`
      INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
      VALUES ($1, $2, $3, $4, $5::jsonb);
    `, [
      auditId,
      recoveryCase.merchant_id,
      id,
      'HUMAN_APPROVAL_GRANTED',
      JSON.stringify({
        approved_by: 'Merchant Manager',
        approved_at: new Date().toISOString(),
        amount_paise: recoveryCase.amount_at_risk_paise
      })
    ]);

    // Execute Payment Link creation using temporary override logic for approved cases
    let executionResult;
    try {
      executionResult = await executePaymentLinkRecoveryService(id);
    } catch (err) {
      // If blocked solely due to high value threshold requirement, bypass and execute directly
      if (err.message.includes('human approval')) {
        const { createPaymentLinkService } = await import('../services/razorpayService.js');
        const customerRes = await query(`SELECT * FROM customers WHERE id = $1;`, [recoveryCase.customer_id]);
        const customer = customerRes.rows[0];

        const rzpResponse = await createPaymentLinkService({
          amount_paise: parseInt(recoveryCase.amount_at_risk_paise, 10),
          description: `RazorRecover Payment Recovery (Human Approved) for Order #${id.slice(0, 8)}`,
          customer_name: customer ? customer.name : 'Valued Customer',
          customer_email: customer ? customer.email : 'customer@example.com',
          customer_phone: customer ? customer.phone : '+919876543210',
          notes: { recovery_case_id: id }
        });

        const actionId = crypto.randomUUID();
        await query(`
          INSERT INTO recovery_actions (id, recovery_case_id, action_type, status, response_data, executed_at)
          VALUES ($1, $2, 'CREATE_PAYMENT_LINK', 'SUCCESS', $3::jsonb, CURRENT_TIMESTAMP);
        `, [actionId, id, JSON.stringify({ payment_link_id: rzpResponse.id, payment_link_url: rzpResponse.short_url, approved_by_human: true })]);

        await query(`
          UPDATE recovery_cases
          SET recovery_link_id = $1, recovery_link_url = $2, status = 'RECOVERING', updated_at = CURRENT_TIMESTAMP
          WHERE id = $3;
        `, [rzpResponse.id, rzpResponse.short_url, id]);

        executionResult = {
          success: true,
          is_duplicate_prevented: false,
          data: {
            action: 'PAYMENT_LINK',
            status: 'SUCCESS',
            payment_link_id: rzpResponse.id,
            payment_link_url: rzpResponse.short_url
          }
        };
      } else {
        throw err;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Human approval granted successfully. Recovery action executed.',
      data: executionResult
    });
  } catch (error) {
    next(error);
  }
};

export const rejectCaseRecovery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Rejected by Merchant Manager' } = req.body || {};

    const caseRes = await query(`SELECT * FROM recovery_cases WHERE id = $1;`, [id]);
    if (caseRes.rows.length === 0) {
      throw new ApiError(`Recovery Case with ID '${id}' not found`, 404);
    }
    const recoveryCase = caseRes.rows[0];

    // Log Human Rejection Audit Log
    const auditId = crypto.randomUUID();
    await query(`
      INSERT INTO audit_logs (id, merchant_id, recovery_case_id, event_type, details)
      VALUES ($1, $2, $3, $4, $5::jsonb);
    `, [
      auditId,
      recoveryCase.merchant_id,
      id,
      'HUMAN_APPROVAL_REJECTED',
      JSON.stringify({
        rejected_by: 'Merchant Manager',
        reason,
        rejected_at: new Date().toISOString()
      })
    ]);

    // Update case status to TERMINATED
    await query(`
      UPDATE recovery_cases
      SET status = 'TERMINATED', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, [id]);

    res.status(200).json({
      success: true,
      message: `Recovery case '${id}' rejected by manager. Case status set to TERMINATED.`,
      data: {
        recovery_case_id: id,
        status: 'TERMINATED',
        reason
      }
    });
  } catch (error) {
    next(error);
  }
};
