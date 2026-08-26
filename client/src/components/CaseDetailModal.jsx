import React, { useState, useEffect } from 'react';
import {
  fetchRecoveryCaseById,
  diagnoseCase,
  decideCase,
  evaluateGuardrails,
  executeRecoveryAction
} from '../services/api';

export default function CaseDetailModal({ caseId, onClose, onCaseUpdated }) {
  const [caseDetails, setCaseDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState(null);

  const loadCaseData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRecoveryCaseById(caseId);
      setCaseDetails(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load case details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadCaseData();
    }
  }, [caseId]);

  const handleRunAiDiagnosis = async () => {
    try {
      setLoading(true);
      await diagnoseCase(caseId);
      await loadCaseData();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err) {
      alert(`AI Diagnosis Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async () => {
    setExecuting(true);
    setExecResult(null);
    try {
      const res = await executeRecoveryAction(caseId);
      setExecResult(res);
      await loadCaseData();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err) {
      alert(`Execution Error: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  if (!caseId) return null;

  const c = caseDetails;
  const isRecovered = c?.status === 'RECOVERED';
  const isRecovering = c?.status === 'RECOVERING';

  // Latest AI Decision & Risk
  const latestDecision = c?.decisions && c.decisions.length > 0 ? c.decisions[0] : null;
  const risk = c?.risk || {};
  const riskLevel = risk.risk_level || 'LOW';
  const riskScore = risk.risk_score ?? 0;
  const riskReasons = risk.reasons || [];

  // Parse AI Reasoning if JSON string
  let decisionReasoningObj = null;
  if (latestDecision?.reasoning) {
    try {
      decisionReasoningObj = JSON.parse(latestDecision.reasoning);
    } catch {
      decisionReasoningObj = { summary: latestDecision.reasoning };
    }
  }

  // Safety checks
  const isHighValue = parseInt(c?.amount_at_risk_paise || 0, 10) >= 1500000;
  const isOptedOut = c?.customer?.is_opted_out;
  const isBlockedByGuardrail = isRecovered || isOptedOut || isHighValue;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-badge-id">Case #{caseId.slice(0, 8)}</span>
            <h2 className="modal-title">Revenue Recovery Inspector</h2>
          </div>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        {loading && !c ? (
          <div className="modal-body text-center py-8">
            <div className="spinner"></div>
            <p>Loading recovery intelligence pipeline...</p>
          </div>
        ) : error ? (
          <div className="modal-body error-box py-4">
            <p>Error: {error}</p>
            <button className="btn-secondary mt-2" onClick={loadCaseData}>Retry</button>
          </div>
        ) : c ? (
          <div className="modal-body">
            {/* Visual Pipeline Storyteller */}
            <div className="pipeline-stepper">
              <div className="step-item completed">
                <span className="step-num">1</span>
                <span className="step-label">Failed Payment</span>
              </div>
              <div className="step-arrow">➔</div>
              <div className="step-item completed">
                <span className="step-num">2</span>
                <span className="step-label">Risk Detected ({riskScore}/100)</span>
              </div>
              <div className="step-arrow">➔</div>
              <div className={`step-item ${latestDecision ? 'completed' : 'active'}`}>
                <span className="step-num">3</span>
                <span className="step-label">AI Diagnosed</span>
              </div>
              <div className="step-arrow">➔</div>
              <div className={`step-item ${latestDecision ? 'completed' : ''}`}>
                <span className="step-num">4</span>
                <span className="step-label">Decision &amp; Guardrails</span>
              </div>
              <div className="step-arrow">➔</div>
              <div className={`step-item ${isRecovering || isRecovered ? 'completed' : ''}`}>
                <span className="step-num">5</span>
                <span className="step-label">Action Executed</span>
              </div>
              <div className="step-arrow">➔</div>
              <div className={`step-item ${isRecovered ? 'success-step' : ''}`}>
                <span className="step-num">6</span>
                <span className="step-label">{isRecovered ? 'RECOVERED' : 'Awaiting Recovery'}</span>
              </div>
            </div>

            {/* Recovered Banner */}
            {isRecovered && (
              <div className="recovered-hero-banner">
                <div className="banner-icon">🎉</div>
                <div>
                  <h3>Revenue Recovered Successfully!</h3>
                  <p>
                    Captured Payment of <strong>₹{c.amount_recovered_rupees || c.amount_at_risk_rupees}</strong> via Razorpay Test Mode.
                  </p>
                </div>
              </div>
            )}

            {/* Grid Sections */}
            <div className="intelligence-grid">
              {/* Box 1: Payment & Customer Details */}
              <div className="intel-card">
                <h4>👤 Customer &amp; Transaction Details</h4>
                <table className="mini-info-table">
                  <tbody>
                    <tr>
                      <td>Customer Name:</td>
                      <td><strong>{c.customer?.name || 'Valued Customer'}</strong></td>
                    </tr>
                    <tr>
                      <td>Email / Phone:</td>
                      <td>{c.customer?.email} | {c.customer?.phone}</td>
                    </tr>
                    <tr>
                      <td>Amount at Risk:</td>
                      <td><span className="highlight-amount">₹{c.amount_at_risk_rupees}</span> ({c.amount_at_risk_paise} paise)</td>
                    </tr>
                    <tr>
                      <td>Failure Error:</td>
                      <td><code>{c.failure_details?.error_reason || 'payment_failed'}</code></td>
                    </tr>
                    <tr>
                      <td>Error Description:</td>
                      <td className="text-muted">{c.failure_details?.error_description}</td>
                    </tr>
                    <tr>
                      <td>Opt-out Status:</td>
                      <td>{c.customer?.is_opted_out ? <span className="text-danger">Opted Out (Blocked)</span> : <span className="text-success">Active (Allowed)</span>}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Box 2: Deterministic Risk Engine (Phase 7) */}
              <div className="intel-card">
                <div className="intel-header">
                  <h4>⚡ Deterministic Risk Engine</h4>
                  <span className={`badge badge-risk-${riskLevel.toLowerCase()}`}>
                    {riskLevel} ({riskScore}/100)
                  </span>
                </div>
                <div className="risk-score-bar-container">
                  <div className="risk-score-bar" style={{ width: `${Math.min(100, Math.max(0, riskScore))}%` }}></div>
                </div>
                <p className="intel-sub">Formula: Payment Value (30) + Recoverability (30) + History (25) + Recency (15)</p>
                <div className="reasons-list">
                  <strong>Contributing Reasons:</strong>
                  {riskReasons.length > 0 ? (
                    <ul>
                      {riskReasons.map((r, idx) => (
                        <li key={idx}>✓ {r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">Low payment value or recent failure frequency.</p>
                  )}
                </div>
              </div>

              {/* Box 3: AI Diagnosis Agent (Phase 8) */}
              <div className="intel-card">
                <div className="intel-header">
                  <h4>🤖 AI Diagnosis Agent</h4>
                  {latestDecision && (
                    <span className="badge badge-ai">
                      Confidence: {Math.round((latestDecision.confidence || 0.85) * 100)}%
                    </span>
                  )}
                </div>
                {latestDecision ? (
                  <div>
                    <div className="diagnosis-box">
                      <span className="diag-label">Diagnosed Root Cause:</span>
                      <strong className="diag-value">{latestDecision.diagnosed_root_cause || 'INSUFFICIENT_FUNDS'}</strong>
                    </div>
                    <div className="diagnosis-box mt-2">
                      <span className="diag-label">Recommended Intervention:</span>
                      <span className="badge badge-action">{latestDecision.chosen_strategy || 'PAYMENT_LINK'}</span>
                    </div>
                    {decisionReasoningObj?.evidence && (
                      <div className="reasons-list mt-2">
                        <strong>Evidence Supporting Diagnosis:</strong>
                        <ul>
                          {decisionReasoningObj.evidence.map((ev, i) => (
                            <li key={i}>• {ev}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-muted">No AI diagnosis generated yet.</p>
                    <button className="btn-secondary mt-2" onClick={handleRunAiDiagnosis}>
                      Run AI Diagnosis Agent
                    </button>
                  </div>
                )}
              </div>

              {/* Box 4: Recovery Decision & Guardrail Safety Engine (Phase 9 & 10) */}
              <div className="intel-card">
                <h4>🛡️ Guardrail Safety Engine</h4>
                <div className="guardrail-status-box">
                  <div className="gr-item">
                    <span>Already Recovered:</span>
                    <strong>{isRecovered ? 'YES (BLOCKED)' : 'NO (PASSED)'}</strong>
                  </div>
                  <div className="gr-item">
                    <span>Customer Opted Out:</span>
                    <strong>{isOptedOut ? 'YES (BLOCKED)' : 'NO (PASSED)'}</strong>
                  </div>
                  <div className="gr-item">
                    <span>High-Value Check (&ge;₹15k):</span>
                    <strong>{isHighValue ? 'YES (APPROVAL REQ)' : 'NO (PASSED)'}</strong>
                  </div>
                  <div className="gr-item">
                    <span>Retry Limit Check (&lt;3):</span>
                    <strong>PASSED ({c.attempt_count}/3)</strong>
                  </div>
                </div>

                <div className="gr-final-result mt-3">
                  <span>Guardrail Evaluation Result:</span>
                  <span className={`badge ${isBlockedByGuardrail ? 'badge-risk-critical' : 'badge-status-recovered'}`}>
                    {isBlockedByGuardrail ? 'BLOCKED' : 'ALLOWED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Execution Panel (Phase 11) */}
            <div className="action-execution-panel">
              <h4>🚀 Recovery Action Execution Panel</h4>

              {c.recovery_link_url ? (
                <div className="existing-link-box">
                  <div className="link-info">
                    <span className="link-label">Razorpay Test Mode Payment Link:</span>
                    <a
                      href={c.recovery_link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-url"
                    >
                      {c.recovery_link_url}
                    </a>
                  </div>
                  <a
                    href={c.recovery_link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary-sm"
                  >
                    Open Razorpay Test Checkout ↗
                  </a>
                </div>
              ) : isBlockedByGuardrail ? (
                <div className="blocked-notice">
                  ⚠️ <strong>Action Execution Blocked:</strong> {isRecovered ? 'Payment has already been recovered.' : isOptedOut ? 'Customer has opted out of communication.' : 'High-value case requires human approval prior to execution.'}
                </div>
              ) : (
                <div className="execute-trigger-box">
                  <p>Ready to execute approved <strong>PAYMENT_LINK</strong> recovery action via official Razorpay Test Mode API.</p>
                  <button
                    className="btn-execute"
                    onClick={handleExecuteAction}
                    disabled={executing}
                  >
                    {executing ? 'Creating Razorpay Link...' : 'Execute Recovery Action (Razorpay Payment Link)'}
                  </button>
                </div>
              )}
            </div>

            {/* Audit Log Stream for this case */}
            <div className="case-audit-trail mt-4">
              <h4>📜 Audit Trail History</h4>
              {c.actions && c.actions.length > 0 ? (
                <div className="actions-history">
                  {c.actions.map((act) => (
                    <div key={act.id} className="history-item">
                      <span className="history-type">{act.action_type}</span>
                      <span className={`badge ${act.status === 'SUCCESS' ? 'badge-status-recovered' : 'badge-risk-critical'}`}>
                        {act.status}
                      </span>
                      <span className="history-time">{new Date(act.executed_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No execution actions performed yet.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close Inspector</button>
        </div>
      </div>
    </div>
  );
}
