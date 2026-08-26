import { query } from '../db/index.js';
import { ApiError } from '../middleware/errorHandler.js';

export const getTransactionsService = async ({ page = 1, limit = 20, status, search }) => {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let whereClauses = [];
  let queryParams = [];

  if (status) {
    queryParams.push(status);
    whereClauses.push(`t.status = $${queryParams.length}`);
  }

  if (search) {
    queryParams.push(`%${search}%`);
    whereClauses.push(`(t.razorpay_payment_id ILIKE $${queryParams.length} OR c.name ILIKE $${queryParams.length} OR c.email ILIKE $${queryParams.length})`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count query
  const countSql = `
    SELECT COUNT(*) 
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    ${whereSql};
  `;
  const countRes = await query(countSql, queryParams);
  const totalItems = parseInt(countRes.rows[0].count, 10);

  // Data query
  queryParams.push(limitNum, offset);
  const dataSql = `
    SELECT 
      t.id,
      t.razorpay_payment_id,
      t.razorpay_order_id,
      t.amount_paise,
      t.currency,
      t.method,
      t.status,
      t.created_at,
      c.id AS customer_id,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      pf.error_code,
      pf.error_reason,
      pf.error_description
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN payment_failures pf ON t.id = pf.transaction_id
    ${whereSql}
    ORDER BY t.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length};
  `;

  const dataRes = await query(dataSql, queryParams);

  const formattedTransactions = dataRes.rows.map(row => ({
    id: row.id,
    razorpay_payment_id: row.razorpay_payment_id,
    razorpay_order_id: row.razorpay_order_id,
    amount_paise: parseInt(row.amount_paise, 10),
    amount_rupees: (parseInt(row.amount_paise, 10) / 100).toFixed(2),
    currency: row.currency,
    method: row.method,
    status: row.status,
    created_at: row.created_at,
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone
    },
    failure: row.error_reason ? {
      error_code: row.error_code,
      error_reason: row.error_reason,
      error_description: row.error_description
    } : null
  }));

  const totalPages = Math.ceil(totalItems / limitNum);

  return {
    transactions: formattedTransactions,
    pagination: {
      total: totalItems,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  };
};

export const getTransactionByIdService = async (id) => {
  const dataSql = `
    SELECT 
      t.id,
      t.razorpay_payment_id,
      t.razorpay_order_id,
      t.amount_paise,
      t.currency,
      t.method,
      t.status,
      t.created_at,
      c.id AS customer_id,
      c.name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      pf.id AS failure_id,
      pf.event_id,
      pf.error_code,
      pf.error_reason,
      pf.error_description,
      pf.failed_at
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN payment_failures pf ON t.id = pf.transaction_id
    WHERE t.id = $1 OR t.razorpay_payment_id = $1;
  `;

  const res = await query(dataSql, [id]);

  if (res.rows.length === 0) {
    throw new ApiError(`Transaction with ID or Payment ID '${id}' not found`, 404);
  }

  const row = res.rows[0];

  return {
    id: row.id,
    razorpay_payment_id: row.razorpay_payment_id,
    razorpay_order_id: row.razorpay_order_id,
    amount_paise: parseInt(row.amount_paise, 10),
    amount_rupees: (parseInt(row.amount_paise, 10) / 100).toFixed(2),
    currency: row.currency,
    method: row.method,
    status: row.status,
    created_at: row.created_at,
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone
    },
    failure: row.failure_id ? {
      id: row.failure_id,
      event_id: row.event_id,
      error_code: row.error_code,
      error_reason: row.error_reason,
      error_description: row.error_description,
      failed_at: row.failed_at
    } : null
  };
};
