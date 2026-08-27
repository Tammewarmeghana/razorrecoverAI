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
      <div className="metric-exec-card card-emerald">
        <div className="metric-exec-header">
          <span className="metric-exec-label">REVENUE RECOVERED</span>
          <span className="metric-exec-icon icon-emerald">💰</span>
        </div>
        <div className="metric-exec-value val-emerald">
          ₹{recoveredRupees.toLocaleString('en-IN')}
        </div>
        <div className="metric-exec-subtext">
          <span>{successfulRecoveries} successful recovery events</span>
        </div>
      </div>

      {/* Card 2: Recovery Rate */}
      <div className="metric-exec-card card-violet">
        <div className="metric-exec-header">
          <span className="metric-exec-label">RECOVERY RATE</span>
          <span className="metric-exec-icon icon-violet">📈</span>
        </div>
        <div className="metric-exec-value val-violet">
          {ratePercent}%
        </div>
        <div className="metric-exec-subtext">
          <span>Autonomous AI conversion efficiency</span>
        </div>
      </div>

      {/* Card 3: Failed Payment Cases */}
      <div className="metric-exec-card card-cyan">
        <div className="metric-exec-header">
          <span className="metric-exec-label">FAILED RECOVERY CASES</span>
          <span className="metric-exec-icon icon-cyan">📋</span>
        </div>
        <div className="metric-exec-value val-cyan">
          {totalFailed}
        </div>
        <div className="metric-exec-subtext">
          <span>Ingested across {totalProcessed} transactions</span>
        </div>
      </div>

      {/* Card 4: Revenue At Risk */}
      <div className="metric-exec-card card-amber">
        <div className="metric-exec-header">
          <span className="metric-exec-label">REVENUE AT RISK</span>
          <span className="metric-exec-icon icon-amber">⚠️</span>
        </div>
        <div className="metric-exec-value val-amber">
          ₹{atRiskRupees.toLocaleString('en-IN')}
        </div>
        <div className="metric-exec-subtext">
          <span>Targeted for AI diagnosis &amp; recovery</span>
        </div>
      </div>
    </div>
  );
}
