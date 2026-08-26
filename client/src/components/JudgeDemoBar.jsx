import React from 'react';

export default function JudgeDemoBar({ onOpenSimulator, pendingApprovalsCount, onOpenApprovals }) {
  return (
    <div className="judge-demo-bar">
      <div className="demo-bar-info">
        <span className="demo-badge">🏆 Hackathon Demo Mode</span>
        <span className="demo-title">Razorpay AI Revenue Recovery Engine</span>
      </div>

      <div className="demo-bar-actions">
        <button className="btn-sim-trigger" onClick={onOpenSimulator}>
          ⚡ Run Live Failure Simulator
        </button>

        {pendingApprovalsCount > 0 && (
          <button className="btn-approval-trigger" onClick={onOpenApprovals}>
            🛡️ Manager Approval Queue
            <span className="badge-approval-count">{pendingApprovalsCount}</span>
          </button>
        )}
      </div>
    </div>
  );
}
