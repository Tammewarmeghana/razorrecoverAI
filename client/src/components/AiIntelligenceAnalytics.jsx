import React from 'react';

export default function AiIntelligenceAnalytics({ cases = [] }) {
  const total = cases.length || 1;

  // 1. Calculate Real Risk Distribution
  const riskCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  cases.forEach(c => {
    const level = (c.risk_level || 'LOW').toUpperCase();
    if (riskCounts[level] !== undefined) riskCounts[level]++;
  });

  // 2. Calculate Real Failure Reasons
  const failureReasonCounts = {};
  cases.forEach(c => {
    const reason = c.payment_failure?.error_reason || 'unknown';
    failureReasonCounts[reason] = (failureReasonCounts[reason] || 0) + 1;
  });
  const topFailures = Object.entries(failureReasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // 3. Calculate Real Strategy Distribution
  const strategyCounts = {};
  cases.forEach(c => {
    const strategy = c.decisions?.[0]?.chosen_strategy || 'PAYMENT_LINK';
    strategyCounts[strategy] = (strategyCounts[strategy] || 0) + 1;
  });
  const topStrategies = Object.entries(strategyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="intelligence-analytics-grid">
      {/* Risk Distribution Card */}
      <div className="intel-card">
        <div className="intel-header">
          <h4>🎯 Risk Score Distribution</h4>
          <span className="text-muted font-xs">0–100 Mathematical Engine</span>
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
          <span className="text-muted font-xs">Technical Root Cause</span>
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
                    <span className="error-reason-code">{reason}</span>
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
