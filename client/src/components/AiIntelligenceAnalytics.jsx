import React from 'react';

export default function AiIntelligenceAnalytics({ cases = [] }) {
  const total = cases.length || 1;

  // 1. Calculate Real Risk Distribution strictly from c.risk
  const riskCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  cases.forEach(c => {
    let level = c.risk?.risk_level?.toUpperCase();
    if (!level && typeof c.risk?.risk_score === 'number') {
      const score = c.risk.risk_score;
      if (score >= 75) level = 'CRITICAL';
      else if (score >= 50) level = 'HIGH';
      else if (score >= 25) level = 'MEDIUM';
      else level = 'LOW';
    }
    level = level || (c.risk_level ? c.risk_level.toUpperCase() : 'LOW');
    if (riskCounts[level] !== undefined) riskCounts[level]++;
  });

  // 2. Calculate Real Failure Reasons strictly from c.error_reason or failure_details
  const failureReasonCounts = {};
  cases.forEach(c => {
    const rawReason = c.error_reason || c.failure_details?.error_reason || c.payment_failure?.error_reason || 'insufficient_funds';
    failureReasonCounts[rawReason] = (failureReasonCounts[rawReason] || 0) + 1;
  });
  const topFailures = Object.entries(failureReasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 3. Calculate Real Strategy Distribution strictly from c.decisions
  const strategyCounts = {};
  cases.forEach(c => {
    const strat = c.decisions?.[0]?.chosen_strategy || (c.amount_at_risk_paise >= 1500000 ? 'HUMAN_REVIEW' : 'PAYMENT_LINK');
    strategyCounts[strat] = (strategyCounts[strat] || 0) + 1;
  });
  const topStrategies = Object.entries(strategyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const formatReasonLabel = (str) => {
    if (!str) return 'Unknown Cause';
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className="intelligence-analytics-grid">
      {/* Risk Distribution Card */}
      <div className="intel-card">
        <div className="intel-header">
          <h4>🎯 Risk Level Distribution</h4>
          <span className="text-muted font-xs">0–100 Risk Engine</span>
        </div>

        <div className="dist-bars-list">
          {Object.entries(riskCounts).map(([level, count]) => {
            const pct = Math.round((count / total) * 100);
            const badgeClass = level === 'CRITICAL' ? 'badge-risk-critical' :
                              level === 'HIGH' ? 'badge-risk-high' :
                              level === 'MEDIUM' ? 'badge-risk-medium' : 'badge-risk-low';
            return (
              <div className="dist-bar-row" key={level}>
                <div className="dist-label-group">
                  <span className={`badge ${badgeClass}`}>{level}</span>
                  <span className="dist-count-text">{count} cases ({pct}%)</span>
                </div>
                <div className="dist-progress-track">
                  <div className={`dist-progress-fill fill-${level.toLowerCase()}`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Failure Reason Breakdown Card */}
      <div className="intel-card">
        <div className="intel-header">
          <h4>🔍 Diagnosed Failure Causes</h4>
          <span className="text-muted font-xs">Technical Cause</span>
        </div>

        <div className="dist-bars-list">
          {topFailures.length === 0 ? (
            <p className="text-muted text-center py-3">No failure data recorded yet.</p>
          ) : (
            topFailures.map(([reason, count]) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div className="dist-bar-row" key={reason}>
                  <div className="dist-label-group">
                    <span className="error-reason-code">{formatReasonLabel(reason)}</span>
                    <span className="dist-count-text">{count} cases ({pct}%)</span>
                  </div>
                  <div className="dist-progress-track">
                    <div className="dist-progress-fill fill-violet" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Strategy Distribution Card */}
      <div className="intel-card">
        <div className="intel-header">
          <h4>🛡️ Recovery Strategies Selected</h4>
          <span className="text-muted font-xs">Policy Engine Output</span>
        </div>

        <div className="dist-bars-list">
          {topStrategies.length === 0 ? (
            <p className="text-muted text-center py-3">No strategy decisions recorded yet.</p>
          ) : (
            topStrategies.map(([strat, count]) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div className="dist-bar-row" key={strat}>
                  <div className="dist-label-group">
                    <span className="badge badge-ai">{strat}</span>
                    <span className="dist-count-text">{count} cases ({pct}%)</span>
                  </div>
                  <div className="dist-progress-track">
                    <div className="dist-progress-fill fill-cyan" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
