import { getRecoveryActionsService } from '../services/recoveryActionService.js';

export const getRecoveryActions = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await getRecoveryActionsService({ page, limit });
    res.status(200).json({
      success: true,
      data: result.actions,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};
