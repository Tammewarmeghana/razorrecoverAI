import React, { useState } from 'react';
import { approveHumanCase, rejectHumanCase } from '../services/api';

export default function HumanApprovalQueue({ cases = [], onRefresh }) {
  const [processingId, setProcessingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Filter cases requiring manager approval (high-value >= ₹15k or UNKNOWN diagnosis)
  const approvalCases = cases.filter(c => 
    c.status !== 'RECOVERED' && 
    c.status !== 'TERMINATED' && 
    (parseInt(c.amount_at_risk_paise || 0, 10) >= 1500000 || c.decisions?.[0]?.diagnosed_root_cause === 'UNKNOWN')
  );

  const handleApprove = async (caseId) => {
    setProcessingId(caseId);
    setActionError(null);
    try {
      await approveHumanCase(caseId);
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(err.message || 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (caseId) => {
    setProcessingId(caseId);
    setActionError(null);
    try {
      await rejectHumanCase(caseId, 'Rejected by merchant manager');
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(err.message || 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="approval-card">
      <div className="card-header-row">
        <div>
          <h3 className="section-title">🛡️ Manager Human Approval Queue ({approvalCases.length} Pending)</h3>
          <p className="section-subtext">High-value transactions (&ge;₹15,000) and unclassified cases flagged for human review</p>
        </div>
        <button className="btn-secondary-luxury" onClick={onRefresh}>
          🔄 Refresh Queue
        </button>
      </div>

      {actionError && <div className="error-banner mb-3">⚠️ {actionError}</div>}

      <div className="table-container-luxury">
        <table className="cases-table-luxury">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Amount</th>
              <th>Flag Reason</th>
              <th>AI Diagnosis</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {approvalCases.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-5 text-center text-muted">
                  No cases currently require human manager approval.
                </td>
              </tr>
            ) : (
              approvalCases.map((c) => {
                const isHighValue = parseInt(c.amount_at_risk_paise || 0, 10) >= 1500000;
                const flagReason = isHighValue ? 'High-Value Check (≥₹15k)' : 'Unclassified AI Cause';

                return (
                  <tr key={c.id}>
                    <td>
                      <div className="customer-cell">
                        <strong className="customer-name">{c.customer?.name || 'Valued Customer'}</strong>
                        <span className="customer-sub">{c.customer?.email}</span>
                      </div>
                    </td>
                    <td>
                      <strong className="amount-cell text-emerald">₹{c.amount_at_risk_rupees}</strong>
                    </td>
                    <td>
                      <span className="badge badge-risk-high">{flagReason}</span>
                    </td>
                    <td>
                      <span className="badge badge-ai">
                        {c.decisions?.[0]?.diagnosed_root_cause || 'UNKNOWN'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-status-detected">{c.status}</span>
                    </td>
                    <td>
                      <div className="header-buttons">
                        <button
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          onClick={() => handleApprove(c.id)}
                          disabled={processingId === c.id}
                        >
                          {processingId === c.id ? 'Approving...' : '✓ Approve'}
                        </button>
                        <button
                          className="btn-secondary-luxury"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                          onClick={() => handleReject(c.id)}
                          disabled={processingId === c.id}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
