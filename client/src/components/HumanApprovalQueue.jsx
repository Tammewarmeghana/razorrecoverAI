import React, { useState } from 'react';
import { approveHumanCase, rejectHumanCase } from '../services/api';

export default function HumanApprovalQueue({ cases = [], onRefresh }) {
  const [processingId, setProcessingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Filter cases requiring manager approval (high-value >= ₹15k OR unknown diagnosis)
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
      await rejectHumanCase(caseId, 'Manager manual rejection');
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionError(err.message || 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="activity-feed-card">
      <div className="card-header-row">
        <div>
          <h3 className="section-title">🛡️ Manager Human Approval Queue ({approvalCases.length} Pending)</h3>
          <p className="section-subtext">High-value transactions (&ge;₹15,000) and edge-case AI diagnoses requiring human oversight</p>
        </div>
        <button className="btn-refresh-control" onClick={onRefresh}>
          🔄 Refresh Queue
        </button>
      </div>

      {actionError && <div className="error-banner mb-3">⚠️ {actionError}</div>}

      <div className="table-container-luxury mt-3">
        <table className="cases-table-luxury">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Amount at Risk</th>
              <th>Flag Reason</th>
              <th>AI Diagnosis</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {approvalCases.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-5 text-center text-muted">
                  ✨ No cases currently require human manager approval. All clear!
                </td>
              </tr>
            ) : (
              approvalCases.map((c) => {
                const amountRupees = c.amount_at_risk_rupees || (c.amount_at_risk_paise / 100).toFixed(2);
                const isHighValue = parseInt(c.amount_at_risk_paise || 0, 10) >= 1500000;
                const diag = c.decisions?.[0]?.diagnosed_root_cause || 'UNKNOWN';

                return (
                  <tr key={c.id}>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-name">{c.customer?.name || 'Valued Customer'}</span>
                        <span className="customer-sub">{c.customer?.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="amount-cell text-amber">₹{amountRupees}</span>
                    </td>
                    <td>
                      <span className="badge badge-risk-high">
                        {isHighValue ? 'HIGH VALUE (≥₹15k)' : 'UNKNOWN DIAGNOSIS'}
                      </span>
                    </td>
                    <td>
                      <span className="error-reason-code">{diag}</span>
                    </td>
                    <td>
                      <span className="badge badge-status-detected">{c.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn-open-razorpay"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                          onClick={() => handleApprove(c.id)}
                          disabled={processingId === c.id}
                        >
                          {processingId === c.id ? 'Processing...' : '✅ Approve'}
                        </button>
                        <button
                          className="btn-secondary-luxury"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', backgroundColor: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.3)' }}
                          onClick={() => handleReject(c.id)}
                          disabled={processingId === c.id}
                        >
                          ❌ Reject
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
