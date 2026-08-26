import { query } from '../db/index.js';

export const getAuditLogsService = async ({ page = 1, limit = 20, eventType }) => {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let whereClauses = [];
  let queryParams = [];

  if (eventType) {
    queryParams.push(eventType);
    whereClauses.push(`event_type = $${queryParams.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) FROM audit_logs ${whereSql};`;
  const countRes = await query(countSql, queryParams);
  const totalItems = parseInt(countRes.rows[0].count, 10);

  queryParams.push(limitNum, offset);
  const dataSql = `
    SELECT id, merchant_id, recovery_case_id, event_type, details, created_at
    FROM audit_logs
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length};
  `;

  const dataRes = await query(dataSql, queryParams);
  const totalPages = Math.ceil(totalItems / limitNum);

  return {
    logs: dataRes.rows,
    pagination: {
      total: totalItems,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  };
};
