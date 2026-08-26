import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';

export const getRecoveryCasesService = async ({ page = 1, limit = 20, status, riskLevel }) => {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let whereClauses = [];
  let queryParams = [];

  if (status) {
    queryParams.push(status);
    whereClauses.push(`rc.status = $${queryParams.length}`);
  }

  if (riskLevel) {
    queryParams.push(riskLevel.toUpperCase());
    whereClauses.push(`rc.risk_level = $${queryParams.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) 
    FROM recovery_cases rc
    ${whereSql};
  `;
  const countRes = await query(countSql, queryParams);
  const totalItems = parseInt(countRes.rows[0].count, 10);

  queryParams.push(limitNum, offset);
  const dataSql = `
    SELECT 
      rc.id,
      rc.amount_at_risk_paise,
      rc.amount_recovered_paise,
      rc.status,
      rc.attempt_count,
      rc.contact_count,
      rc.recovery_link_url,
      rc.risk_score,
      rc.risk_level,
      rc.risk_reasons,
      rc.created_at,
      rc.updated_at,
      c.id AS customer_id,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      pf.error_code,
      pf.error_reason,
      t.razorpay_payment_id
    FROM recovery_cases rc
    LEFT JOIN customers c ON rc.customer_id = c.id
    LEFT JOIN payment_failures pf ON rc.payment_failure_id = pf.id
    LEFT JOIN transactions t ON pf.transaction_id = t.id
    ${whereSql}
    ORDER BY rc.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length};
  `;

  const dataRes = await query(dataSql, queryParams);

  const formattedCases = dataRes.rows.map(row => ({
    id: row.id,
    payment_id: row.razorpay_payment_id,
    amount_at_risk_paise: parseInt(row.amount_at_risk_paise, 10),
    amount_at_risk_rupees: (parseInt(row.amount_at_risk_paise, 10) / 100).toFixed(2),
    amount_recovered_paise: parseInt(row.amount_recovered_paise, 10),
    amount_recovered_rupees: (parseInt(row.amount_recovered_paise, 10) / 100).toFixed(2),
    status: row.status,
    attempt_count: row.attempt_count,
    contact_count: row.contact_count,
    recovery_link_url: row.recovery_link_url,
    risk: {
      risk_score: row.risk_score,
      risk_level: row.risk_level,
      reasons: typeof row.risk_reasons === 'string' ? JSON.parse(row.risk_reasons) : row.risk_reasons
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone
    },
    error_reason: row.error_reason
  }));

  const totalPages = Math.ceil(totalItems / limitNum);

  return {
    cases: formattedCases,
    pagination: {
      total: totalItems,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  };
};

export const getRecoveryCaseByIdService = async (id) => {
  const dataSql = `
    SELECT 
      rc.id,
      rc.amount_at_risk_paise,
      rc.amount_recovered_paise,
      rc.status,
      rc.attempt_count,
      rc.contact_count,
      rc.recovery_link_url,
      rc.risk_score,
      rc.risk_level,
      rc.risk_reasons,
      rc.created_at,
      rc.updated_at,
      c.id AS customer_id,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      pf.id AS failure_id,
      pf.event_id,
      pf.error_code,
      pf.error_reason,
      pf.error_description,
      t.id AS transaction_id,
      t.razorpay_payment_id,
      t.method AS payment_method
    FROM recovery_cases rc
    LEFT JOIN customers c ON rc.customer_id = c.id
    LEFT JOIN payment_failures pf ON rc.payment_failure_id = pf.id
    LEFT JOIN transactions t ON pf.transaction_id = t.id
    WHERE rc.id = $1;
  `;

  const res = await query(dataSql, [id]);

  if (res.rows.length === 0) {
    throw new ApiError(`Recovery Case with ID '${id}' not found`, 404);
  }

  const row = res.rows[0];

  const decisionsRes = await query(`
    SELECT id, diagnosed_root_cause, chosen_strategy, reasoning, guardrails_passed, decided_at
    FROM agent_decisions
    WHERE recovery_case_id = $1
    ORDER BY decided_at DESC;
  `, [id]);

  const actionsRes = await query(`
    SELECT id, action_type, status, response_data, executed_at
    FROM recovery_actions
    WHERE recovery_case_id = $1
    ORDER BY executed_at DESC;
  `, [id]);

  return {
    id: row.id,
    payment_id: row.razorpay_payment_id,
    amount_at_risk_paise: parseInt(row.amount_at_risk_paise, 10),
    amount_at_risk_rupees: (parseInt(row.amount_at_risk_paise, 10) / 100).toFixed(2),
    amount_recovered_paise: parseInt(row.amount_recovered_paise, 10),
    amount_recovered_rupees: (parseInt(row.amount_recovered_paise, 10) / 100).toFixed(2),
    status: row.status,
    attempt_count: row.attempt_count,
    contact_count: row.contact_count,
    recovery_link_url: row.recovery_link_url,
    risk: {
      risk_score: row.risk_score,
      risk_level: row.risk_level,
      reasons: typeof row.risk_reasons === 'string' ? JSON.parse(row.risk_reasons) : row.risk_reasons
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone
    },
    failure_details: {
      id: row.failure_id,
      event_id: row.event_id,
      error_code: row.error_code,
      error_reason: row.error_reason,
      error_description: row.error_description,
      payment_method: row.payment_method
    },
    decisions: decisionsRes.rows,
    actions: actionsRes.rows
  };
};
