import { getMetricsService } from '../services/metricsService.js';

export const getMetrics = async (req, res, next) => {
  try {
    const metrics = await getMetricsService();
    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (err) {
    next(err);
  }
};
