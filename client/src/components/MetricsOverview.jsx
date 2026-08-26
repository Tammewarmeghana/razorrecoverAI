import React from 'react';

export default function MetricsOverview({ metrics, loading }) {
  if (loading && !metrics) {
    return (
      <div className="metrics-grid loading-skeleton">
        <div className="metric-card skeleton"></div>
        <div className="metric-card skeleton"></div>
        <div className="metric-card skeleton"></div>
        <div className="metric-card skeleton"></div>
      </div>
    );
  }

  const {
    revenue_at_risk_rupees = '0.00',
    recovered_revenue_rupees = '0.00',
    recovery_rate_percent = '0.00',
    successful_recoveries = 0,
    failed_transactions = 0,
    total_transactions = 0
  } = metrics || {};

  return (
    <div className="metrics-grid">
      <div className="metric-card risk">
        <div className="metric-header">
          <span className="metric-icon">⚠️</span>
          <span className="metric-label">Revenue at Risk</span>
        </div>
        <div className="metric-value">₹{revenue_at_risk_rupees}</div>
        <div className="metric-subtext">From {failed_transactions} payment failures</div>
      </div>

      <div className="metric-card recovered">
        <div className="metric-header">
          <span className="metric-icon">✅</span>
          <span className="metric-label">Recovered Revenue</span>
        </div>
        <div className="metric-value highlight">₹{recovered_revenue_rupees}</div>
        <div className="metric-subtext">{successful_recoveries} successful recoveries</div>
      </div>

      <div className="metric-card rate">
        <div className="metric-header">
          <span className="metric-icon">📈</span>
          <span className="metric-label">Recovery Success Rate</span>
        </div>
        <div className="metric-value">{recovery_rate_percent}%</div>
        <div className="metric-subtext">Autonomous recovery efficiency</div>
      </div>

      <div className="metric-card total">
        <div className="metric-header">
          <span className="metric-icon">💳</span>
          <span className="metric-label">Total Transactions</span>
        </div>
        <div className="metric-value">{total_transactions}</div>
        <div className="metric-subtext">Processed by Razorpay</div>
      </div>
    </div>
  );
}
