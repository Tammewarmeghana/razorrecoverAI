import React from 'react';

export default function ExecutiveHeader({
  healthStatus,
  lastUpdatedTime,
  onOpenSimulator,
  pendingApprovalsCount,
  onOpenApprovals,
  onRefresh,
  theme,
  onToggleTheme
}) {
  const isOnline = healthStatus?.status === 'ok';

  return (
    <header className="executive-header">
      <div className="header-brand-container">
        <div className="brand-badge-icon">⚡</div>
        <div className="brand-text-group">
          <div className="brand-title-row">
            <h1 className="brand-title-main">RazorRecover AI</h1>
            <span className="brand-tag">Autonomous Revenue Engine</span>
          </div>
          <p className="brand-subtext">Enterprise Failed Payment Intelligence for Razorpay</p>
        </div>
      </div>

      <div className="header-actions-group">
        <div className="header-status-indicators">
          <div className={`status-pill ${isOnline ? 'status-emerald' : 'status-danger'}`}>
            <span className={`pulse-dot ${isOnline ? 'dot-emerald' : 'dot-danger'}`}></span>
            {isOnline ? 'System Operational' : 'Offline'}
          </div>

          <div className="status-pill status-cyan">
            <span className="dot-cyan"></span>
            Razorpay Test Mode
          </div>

          {lastUpdatedTime && (
            <span className="last-updated-text">
              Updated {Math.max(0, Math.floor((Date.now() - lastUpdatedTime.getTime()) / 1000))}s ago
            </span>
          )}
        </div>

        <div className="header-buttons">
          <button
            className="btn-theme-toggle"
            onClick={onToggleTheme}
            title="Toggle Theme"
          >
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>

          <button className="btn-sim-trigger" onClick={onOpenSimulator}>
            ⚡ Run Failure Simulator
          </button>

          {pendingApprovalsCount > 0 && (
            <button className="btn-approval-badge" onClick={onOpenApprovals}>
              🛡️ Approvals
              <span className="badge-count-pill">{pendingApprovalsCount}</span>
            </button>
          )}

          <button className="btn-icon-refresh" onClick={onRefresh} title="Refresh Data">
            🔄
          </button>
        </div>
      </div>
    </header>
  );
}
