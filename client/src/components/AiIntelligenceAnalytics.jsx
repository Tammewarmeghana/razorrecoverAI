import React, { useState } from 'react';

export default function AiIntelligenceAnalytics({ cases = [] }) {
  const [hoverPoint, setHoverPoint] = useState(null);
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

  // Build Animated SVG Line Points from actual case data (up to 12 points)
  const chartCases = cases.slice(0, 12).reverse();
  const width = 500;
  const height = 150;
  const padding = 20;

  const points = chartCases.map((c, index) => {
    const x = padding + (index / (Math.max(1, chartCases.length - 1))) * (width - 2 * padding);
    const amount = Number(c.amount_at_risk_rupees || (c.amount_at_risk_paise / 100)) || 500;
    const maxAmt = Math.max(...chartCases.map(i => Number(i.amount_at_risk_rupees || (i.amount_at_risk_paise / 100)) || 500), 5000);
    const minAmt = Math.min(...chartCases.map(i => Number(i.amount_at_risk_rupees || (i.amount_at_risk_paise / 100)) || 500), 0);
    const y = height - padding - ((amount - minAmt) / Math.max(1, maxAmt - minAmt)) * (height - 2 * padding);
    return { x, y, amount, caseObj: c };
  });

  const pathD = points.length > 0 
    ? points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : '';

  return (
    <div className="intelligence-analytics-grid">
      {/* Animated Interactive Failure & Risk Trend Graph */}
      <div className="intel-card chart-trend-card">
        <div className="intel-header">
          <div>
            <h4>📈 Failure Cause &amp; Revenue Risk Trend</h4>
            <span className="text-muted font-xs">Interactive real-time transaction curve</span>
          </div>
          <span className="badge badge-ai">LIVE SVG ENGINE</span>
        </div>

        <div className="svg-chart-container">
          <svg viewBox={`0 0 ${width} ${height}`} className="animated-svg-chart">
            <defs>
              <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="chartLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />

            {/* Area & Line */}
            {points.length > 1 && (
              <>
                <path d={areaD} fill="url(#chartAreaGrad)" />
                <path d={pathD} fill="none" stroke="url(#chartLineGrad)" strokeWidth="3" strokeLinecap="round" className="animated-line-path" />
              </>
            )}

            {/* Interactive Data Points */}
            {points.map((p, idx) => (
              <g key={idx} className="chart-node-group" onMouseEnter={() => setHoverPoint(p)} onMouseLeave={() => setHoverPoint(null)}>
                <circle cx={p.x} cy={p.y} r="5" className="chart-circle-node" />
                <circle cx={p.x} cy={p.y} r="9" className="chart-circle-pulse" />
              </g>
            ))}
          </svg>

          {/* Hover Tooltip */}
          {hoverPoint && (
            <div className="chart-tooltip-floating" style={{ left: `${(hoverPoint.x / width) * 100}%`, top: '10%' }}>
              <div className="tooltip-title">{hoverPoint.caseObj.customer?.name || 'Customer'}</div>
              <div className="tooltip-sub font-mono">₹{hoverPoint.amount} | {formatReasonLabel(hoverPoint.caseObj.error_reason || hoverPoint.caseObj.payment_failure?.error_reason)}</div>
              <div className="tooltip-risk">Risk Score: {hoverPoint.caseObj.risk?.risk_score || hoverPoint.caseObj.risk_score || 0}/100</div>
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}
