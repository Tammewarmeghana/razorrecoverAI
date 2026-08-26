import { getTransactionsService, getTransactionByIdService } from '../services/transactionService.js';

export const getTransactions = async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query;
    const result = await getTransactionsService({ page, limit, status, search });
    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transaction = await getTransactionByIdService(id);
    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};
