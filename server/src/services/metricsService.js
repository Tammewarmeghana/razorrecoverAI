import { query } from '../db/index.js';

export const getMetricsService = async () => {
  // 1. Total Transactions
  const totalTxnRes = await query(`SELECT COUNT(*) FROM transactions;`, []);
  const totalTransactions = parseInt(totalTxnRes.rows[0].count, 10);

  // 2. Failed Transactions (status: failed or abandoned)
  const failedTxnRes = await query(`
    SELECT COUNT(*) FROM transactions WHERE status IN ('failed', 'abandoned');
  `, []);
  const failedTransactions = parseInt(failedTxnRes.rows[0].count, 10);

  // 3. Revenue at Risk (paise & rupees)
  const revRiskRes = await query(`
    SELECT COALESCE(SUM(amount_at_risk_paise), 0) AS total_paise FROM recovery_cases;
  `, []);
  const revenueAtRiskPaise = BigInt(revRiskRes.rows[0].total_paise || 0);
  const revenueAtRiskRupees = (Number(revenueAtRiskPaise) / 100).toFixed(2);

  // 4. Total Recovery Attempts
  const attemptsRes = await query(`
    SELECT COALESCE(SUM(attempt_count), 0) AS total_attempts FROM recovery_cases;
  `, []);
  const recoveryAttempts = parseInt(attemptsRes.rows[0].total_attempts, 10);

  // 5. Successful Recoveries
  const successRecRes = await query(`
    SELECT COUNT(*) FROM recovery_cases WHERE status = 'RECOVERED';
  `, []);
  const successfulRecoveries = parseInt(successRecRes.rows[0].count, 10);

  // 6. Recovered Revenue (paise & rupees)
  const recoveredRevRes = await query(`
    SELECT COALESCE(SUM(amount_recovered_paise), 0) AS total_paise FROM recovery_cases WHERE status = 'RECOVERED';
  `, []);
  const recoveredRevenuePaise = BigInt(recoveredRevRes.rows[0].total_paise || 0);
  const recoveredRevenueRupees = (Number(recoveredRevenuePaise) / 100).toFixed(2);

  // 7. Recovery Rate (% of failed cases recovered)
  const totalCasesRes = await query(`SELECT COUNT(*) FROM recovery_cases;`, []);
  const totalCases = parseInt(totalCasesRes.rows[0].count, 10);

  const recoveryRatePercent = totalCases > 0 
    ? parseFloat(((successfulRecoveries / totalCases) * 100).toFixed(2)) 
    : 0.00;

  return {
    total_transactions: totalTransactions,
    failed_transactions: failedTransactions,
    revenue_at_risk_paise: revenueAtRiskPaise.toString(),
    revenue_at_risk_rupees: parseFloat(revenueAtRiskRupees),
    recovery_attempts: recoveryAttempts,
    successful_recoveries: successfulRecoveries,
    recovered_revenue_paise: recoveredRevenuePaise.toString(),
    recovered_revenue_rupees: parseFloat(recoveredRevenueRupees),
    recovery_rate_percent: recoveryRatePercent,
    summary_formatted: {
      total_transactions: totalTransactions.toLocaleString('en-IN'),
      failed_transactions: failedTransactions.toLocaleString('en-IN'),
      revenue_at_risk: `₹${parseFloat(revenueAtRiskRupees).toLocaleString('en-IN')}`,
      recovery_attempts: recoveryAttempts.toLocaleString('en-IN'),
      successful_recoveries: successfulRecoveries.toLocaleString('en-IN'),
      recovered_revenue: `₹${parseFloat(recoveredRevenueRupees).toLocaleString('en-IN')}`,
      recovery_rate: `${recoveryRatePercent}%`
    }
  };
};
