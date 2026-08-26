import React, { useState } from 'react';
import { approveHumanCase, rejectHumanCase } from '../services/api';

export default function HumanApprovalQueue({ cases, onRefresh }) {
  const [processingId, setProcessingId] = useState(null);

  // Filter high value cases or UNKNOWN diagnosis requiring approval
  const pendingCases = cases.filter(c => 
    c.status !== 'RECOVERED' && 
    c.status !== 'TERMINATED' && 
    (parseInt(c.amount_at_risk_paise || 0, 10) >= 1500000 || c.decisions?.[0]?.diagnosed_root_cause === 'UNKNOWN')
  );

  const handleApprove = async (caseId) => {
    setProcessingId(caseId);
    try {
      await approveHumanCase(caseId);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Approval Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (caseId) => {
    setProcessingId(caseId);
    try {
      await rejectHumanCase(caseId, 'Rejected by manager via Human Approval Queue');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Rejection Error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="approval-section">
      <div className="table-controls">
        <h3>🛡️ Manager Human Approval Queue ({pendingCases.length} Pending)</h3>
        <button className="btn-secondary" onClick={onRefresh}>🔄 Refresh Queue</button>
      </div>

      <div className="table-container">
        <table className="cases-table">
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
            {pendingCases.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4">
                  No cases currently require human approval.
                </td>
              </tr>
            ) : (
              pendingCases.map((c) => {
                const isHighValue = parseInt(c.amount_at_risk_paise || 0, 10) >= 1500000;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-name">{c.customer?.name}</span>
                        <span className="customer-sub">{c.customer?.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="amount-cell text-danger">₹{c.amount_at_risk_rupees}</span>
                    </td>
                    <td>
                      <span className="badge badge-risk-high">
                        {isHighValue ? 'High Value (≥₹15k)' : 'Unknown Diagnosis'}
                      </span>
                    </td>
                    <td>
                      <code>{c.decisions?.[0]?.diagnosed_root_cause || 'UNKNOWN'}</code>
                    </td>
                    <td>
                      <span className="badge badge-status-recovering">REQUIRES APPROVAL</span>
                    </td>
                    <td>
                      <div className="action-button-group">
                        <button
                          className="btn-primary-sm"
                          onClick={() => handleApprove(c.id)}
                          disabled={processingId === c.id}
                        >
                          {processingId === c.id ? 'Processing...' : '✅ Approve & Issue Link'}
                        </button>
                        <button
                          className="btn-secondary"
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
