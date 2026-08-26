import { query } from '../db/index.js';

export const getRecoveryActionsService = async ({ page = 1, limit = 20 }) => {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const countSql = `SELECT COUNT(*) FROM recovery_actions;`;
  const countRes = await query(countSql, []);
  const totalItems = parseInt(countRes.rows[0].count, 10);

  const dataSql = `
    SELECT 
      ra.id,
      ra.recovery_case_id,
      ra.agent_decision_id,
      ra.action_type,
      ra.status,
      ra.response_data,
      ra.executed_at,
      rc.status AS case_status
    FROM recovery_actions ra
    LEFT JOIN recovery_cases rc ON ra.recovery_case_id = rc.id
    ORDER BY ra.executed_at DESC
    LIMIT $1 OFFSET $2;
  `;

  const dataRes = await query(dataSql, [limitNum, offset]);
  const totalPages = Math.ceil(totalItems / limitNum);

  return {
    actions: dataRes.rows,
    pagination: {
      total: totalItems,
      page: pageNum,
      limit: limitNum,
      totalPages
    }
  };
};
