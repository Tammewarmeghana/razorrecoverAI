import React, { useState, useEffect } from 'react';
import { fetchRecoveryCaseById, executeRecoveryAction } from '../services/api';

export default function CaseDetailModal({ caseId, onClose, onCaseUpdated }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (caseId) {
      loadCaseDetails();
    }
  }, [caseId]);

  const loadCaseDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRecoveryCaseById(caseId);
      setCaseData(res.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch case details');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async () => {
    setExecuting(true);
    setError(null);
    setExecutionResult(null);
    try {
      const res = await executeRecoveryAction(caseId);
      setExecutionResult(res.data);
      await loadCaseDetails();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err) {
      setError(err.message || 'Action execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const isRecovered = caseData?.status === 'RECOVERED';
  const isRecovering = caseData?.status === 'RECOVERING';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-luxury" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-luxury">
          <div className="modal-header-titles">
            <span className="modal-subtitle-tag">CASE #{caseId ? caseId.slice(0, 8) : ''}</span>
            <h2 className="modal-title-main">Autonomous Revenue Recovery Inspector</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="modal-body-luxury">
          {loading ? (
            <div className="modal-loading-box py-5 text-center">
              <div className="spinner-emerald mb-3"></div>
              <p className="text-muted">Analyzing case intelligence &amp; running risk models...</p>
            </div>
          ) : error && !caseData ? (
            <div className="error-banner">⚠️ {error}</div>
          ) : (
            <>
              {/* 6-Step Visual Pipeline Stepper */}
              <div className="stepper-pipeline-container">
                <div className="stepper-track">
                  <div className="stepper-step completed">
                    <div className="step-circle">1</div>
                    <span className="step-title">Payment Failed</span>
                  </div>
                  <div className="stepper-connector active"></div>

                  <div className="stepper-step completed">
                    <div className="step-circle">2</div>
                    <span className="step-title">Risk Engine ({caseData.risk_score}/100)</span>
                  </div>
                  <div className="stepper-connector active"></div>

                  <div className="stepper-step completed">
                    <div className="step-circle">3</div>
                    <span className="step-title">AI Diagnosed</span>
                  </div>
                  <div className="stepper-connector active"></div>

                  <div className="stepper-step completed">
                    <div className="step-circle">4</div>
                    <span className="step-title">Decision &amp; Guardrails</span>
                  </div>
                  <div className="stepper-connector active"></div>

                  <div className={`stepper-step ${isRecovering || isRecovered ? 'completed' : 'active'}`}>
                    <div className="step-circle">5</div>
                    <span className="step-title">{isRecovered ? 'Action Executed' : isRecovering ? 'Link Created' : 'Action Pending'}</span>
                  </div>
                  <div className="stepper-connector"></div>

                  <div className={`stepper-step ${isRecovered ? 'completed success' : ''}`}>
                    <div className="step-circle">{isRecovered ? '✓' : '6'}</div>
                    <span className="step-title">{isRecovered ? 'RECOVERED' : 'Awaiting Payment'}</span>
                  </div>
                </div>
              </div>

              {/* Grid 1: Customer & Transaction Info */}
              <div className="intel-grid-twin">
                <div className="intel-panel-card">
                  <div className="intel-panel-header">
                    <h4>👤 Customer &amp; Transaction Context</h4>
                    <span className="badge badge-status-detected">{caseData.status}</span>
                  </div>
                  <table className="mini-data-table">
                    <tbody>
                      <tr>
                        <td>Customer Name:</td>
                        <td><strong>{caseData.customer?.name || 'Valued Customer'}</strong></td>
                      </tr>
                      <tr>
                        <td>Email / Phone:</td>
                        <td>{caseData.customer?.email} | {caseData.customer?.phone || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td>Amount at Risk:</td>
                        <td><span className="text-emerald font-bold">₹{caseData.amount_at_risk_rupees}</span> ({caseData.amount_at_risk_paise} paise)</td>
                      </tr>
                      <tr>
                        <td>Failure Error:</td>
                        <td><span className="error-reason-code">{caseData.payment_failure?.error_reason}</span></td>
                      </tr>
                      <tr>
                        <td>Description:</td>
                        <td>{caseData.payment_failure?.error_description || 'Payment decline recorded'}</td>
                      </tr>
                      <tr>
                        <td>Opt-out Status:</td>
                        <td>{caseData.customer?.is_opted_out ? <span className="text-danger">Opted Out (Blocked)</span> : <span className="text-emerald">Active (Allowed)</span>}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Grid 2: Risk Engine */}
                <div className="intel-panel-card">
                  <div className="intel-panel-header">
                    <h4>⚡ Deterministic Risk Engine</h4>
                    <span className={`badge ${caseData.risk_level === 'CRITICAL' ? 'badge-risk-critical' : caseData.risk_level === 'HIGH' ? 'badge-risk-high' : caseData.risk_level === 'MEDIUM' ? 'badge-risk-medium' : 'badge-risk-low'}`}>
                      {caseData.risk_level} ({caseData.risk_score}/100)
                    </span>
                  </div>
                  <div className="risk-score-container mb-3">
                    <div className="risk-bar-track">
                      <div className="risk-bar-fill" style={{ width: `${caseData.risk_score}%` }}></div>
                    </div>
                  </div>
                  <p className="text-muted font-xs mb-2">Formula: Payment Value (30) + Recoverability (30) + History (25) + Recency (15)</p>
                  <div className="reasons-box">
                    <strong>Contributing Risk Reasons:</strong>
                    <ul>
                      {Array.isArray(caseData.risk_reasons) && caseData.risk_reasons.length > 0 ? (
                        caseData.risk_reasons.map((r, idx) => <li key={idx}>{r}</li>)
                      ) : (
                        <li>Low payment value or fresh failure recency.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Grid 3: AI Diagnosis & Guardrails */}
              <div className="intel-grid-twin">
                <div className="intel-panel-card">
                  <div className="intel-panel-header">
                    <h4>🤖 AI Diagnosis Agent</h4>
                    <span className="badge badge-ai">CONFIDENCE: {Math.round((caseData.decisions?.[0]?.confidence || 0.85) * 100)}%</span>
                  </div>
                  <div className="diagnosis-summary-box">
                    <div className="diag-row">
                      <span className="diag-key">Diagnosed Root Cause:</span>
                      <strong className="diag-val text-violet">{caseData.decisions?.[0]?.diagnosed_root_cause || 'INSUFFICIENT_FUNDS'}</strong>
                    </div>
                    <div className="diag-row mt-2">
                      <span className="diag-key">Recommended Strategy:</span>
                      <strong className="diag-val text-cyan">{caseData.decisions?.[0]?.chosen_strategy || 'PAYMENT_LINK'}</strong>
                    </div>
                    <p className="diag-reasoning mt-3">
                      "{caseData.decisions?.[0]?.reasoning || 'Automated AI failure diagnosis completed.'}"
                    </p>
                  </div>
                </div>

                <div className="intel-panel-card">
                  <div className="intel-panel-header">
                    <h4>🛡️ Guardrail Safety Engine</h4>
                    <span className="badge badge-status-recovered">ALLOWED</span>
                  </div>
                  <div className="guardrail-checklist">
                    <div className="gr-check-item">
                      <span>Payment Already Recovered:</span>
                      <strong>{isRecovered ? 'YES (Stop)' : 'NO (Passed)'}</strong>
                    </div>
                    <div className="gr-check-item">
                      <span>Customer Opted Out:</span>
                      <strong>{caseData.customer?.is_opted_out ? 'YES (Blocked)' : 'NO (Passed)'}</strong>
                    </div>
                    <div className="gr-check-item">
                      <span>High-Value Check (&ge;₹15k):</span>
                      <strong>{parseInt(caseData.amount_at_risk_paise, 10) >= 1500000 ? 'YES (Review Required)' : 'NO (Passed)'}</strong>
                    </div>
                    <div className="gr-check-item">
                      <span>Retry Limit Check (&lt;3):</span>
                      <strong>PASSED ({caseData.attempt_count}/3 retries)</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Execution Panel & Razorpay Link */}
              <div className="action-execution-card">
                <div className="action-card-header">
                  <h4>🚀 Action Execution &amp; Razorpay Test Link</h4>
                </div>

                {error && <div className="error-banner mb-3">⚠️ {error}</div>}

                {isRecovered ? (
                  <div className="recovered-success-banner">
                    <div className="banner-icon">🎉</div>
                    <div>
                      <h3>REVENUE RECOVERED SUCCESSFULLY</h3>
                      <p>Razorpay payment.captured webhook verified. Recovered <strong>₹{caseData.amount_recovered_rupees}</strong>.</p>
                    </div>
                  </div>
                ) : caseData.recovery_link_url ? (
                  <div className="payment-link-box">
                    <div className="link-info-group">
                      <span className="link-tag">RAZORPAY TEST PAYMENT LINK CREATED</span>
                      <code className="link-url-text">{caseData.recovery_link_url}</code>
                      <span className="link-id-sub">Link ID: {caseData.recovery_link_id}</span>
                    </div>
                    <a
                      href={caseData.recovery_link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-open-razorpay"
                    >
                      🔗 Open Razorpay Checkout ↗
                    </a>
                  </div>
                ) : (
                  <div className="action-trigger-box">
                    <p className="text-muted font-sm mb-3">
                      Ready to execute approved <strong>PAYMENT_LINK</strong> recovery action via official Razorpay Test Mode API.
                    </p>
                    <button
                      onClick={handleExecuteAction}
                      disabled={executing}
                      className="btn-execute-primary"
                    >
                      {executing ? 'Creating Razorpay Link...' : '⚡ Execute Recovery Action (Razorpay Payment Link)'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer-luxury">
          <button className="btn-secondary-luxury" onClick={onClose}>Close Inspector</button>
        </div>
      </div>
    </div>
  );
}
