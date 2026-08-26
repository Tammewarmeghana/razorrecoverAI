import { getAuditLogsService } from '../services/auditLogService.js';

export const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, eventType } = req.query;
    const result = await getAuditLogsService({ page, limit, eventType });
    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};
