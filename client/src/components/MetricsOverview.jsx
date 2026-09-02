import React from 'react';

export default function MetricsOverview({ metrics, loading }) {
  if (loading && !metrics) {
    return (
      <div className="metrics-executive-grid">
        {[1, 2, 3, 4].map((n) => (
          <div className="metric-exec-card skeleton-card" key={n}>
            <div className="skeleton-line short mb-2"></div>
            <div className="skeleton-line tall"></div>
          </div>
        ))}
      </div>
    );
  }

  const recoveredRupees = metrics?.recovered_revenue_rupees || 0;
  const atRiskRupees = metrics?.revenue_at_risk_rupees || 0;
  const ratePercent = metrics?.recovery_rate_percent || 0;
  const totalFailed = metrics?.failed_transactions || 0;
  const totalProcessed = metrics?.total_transactions || 0;
  const successfulRecoveries = metrics?.successful_recoveries || 0;

  return (
    <div className="metrics-executive-grid">
      {/* Card 1: Revenue Recovered */}
      <div className="metric-exec-card">
        <div className="metric-exec-header">
          <span className="metric-exec-label">REVENUE RECOVERED</span>
          <span className="badge badge-status-recovered">RECOVERED</span>
        </div>
        <div className="metric-exec-value text-emerald">
          ₹{recoveredRupees.toLocaleString('en-IN')}
        </div>
        <div className="metric-exec-subtext">
          <span>{successfulRecoveries} successful recovery events</span>
        </div>
      </div>

      {/* Card 2: Recovery Rate */}
      <div className="metric-exec-card">
        <div className="metric-exec-header">
          <span className="metric-exec-label">RECOVERY RATE</span>
          <span className="badge badge-ai">AUTONOMOUS</span>
        </div>
        <div className="metric-exec-value">
          {ratePercent}%
        </div>
        <div className="metric-exec-subtext">
          <span>AI recovery conversion rate</span>
        </div>
      </div>

      {/* Card 3: Failed Payment Cases */}
      <div className="metric-exec-card">
        <div className="metric-exec-header">
          <span className="metric-exec-label">FAILED RECOVERY CASES</span>
          <span className="badge badge-status-detected">INGESTED</span>
        </div>
        <div className="metric-exec-value">
          {totalFailed}
        </div>
        <div className="metric-exec-subtext">
          <span>Across {totalProcessed} total transactions</span>
        </div>
      </div>

      {/* Card 4: Revenue At Risk */}
      <div className="metric-exec-card">
        <div className="metric-exec-header">
          <span className="metric-exec-label">REVENUE AT RISK</span>
          <span className="badge badge-risk-high">AT RISK</span>
        </div>
        <div className="metric-exec-value text-amber">
          ₹{atRiskRupees.toLocaleString('en-IN')}
        </div>
        <div className="metric-exec-subtext">
          <span>Targeted for AI risk diagnosis</span>
        </div>
      </div>
    </div>
  );
}
