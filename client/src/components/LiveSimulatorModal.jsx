import React, { useState } from 'react';
import { simulateFailedPayment } from '../services/api';

export default function LiveSimulatorModal({ onClose, onSimulationSuccess }) {
  const [amountRupees, setAmountRupees] = useState(2499);
  const [errorReason, setErrorReason] = useState('insufficient_funds');
  const [customerName, setCustomerName] = useState('Hackathon Judge');
  const [customerEmail, setCustomerEmail] = useState('judge@razorpay.ai');
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [error, setError] = useState(null);

  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setError(null);
    setSimulationResult(null);

    try {
      const res = await simulateFailedPayment({
        amount_rupees: Number(amountRupees),
        error_reason: errorReason,
        customer_name: customerName,
        customer_email: customerEmail
      });

      setSimulationResult(res.data);
      if (onSimulationSuccess) onSimulationSuccess();
    } catch (err) {
      setError(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const snapshot = simulationResult?.pipeline_snapshot;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-luxury" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-luxury">
          <div className="modal-header-titles">
            <span className="modal-subtitle-tag">LIVE DEMO SIMULATOR</span>
            <h2 className="modal-title-main">Simulate Payment Failure &amp; Watch AI Pipeline</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="modal-body-luxury">
          <form onSubmit={handleRunSimulation} className="sim-form-container">
            <div className="sim-form-grid">
              <div className="sim-form-group">
                <label className="sim-label">Preset Failure Scenario:</label>
                <select
                  value={errorReason}
                  onChange={(e) => setErrorReason(e.target.value)}
                  className="sim-select-input"
                >
                  <option value="insufficient_funds">Insufficient Funds (Low Balance)</option>
                  <option value="bank_timeout">Bank/Gateway Technical Timeout (Transient)</option>
                  <option value="otp_timeout">OTP Timeout (User Abandonment)</option>
                  <option value="card_expired">Expired Payment Card</option>
                  <option value="unknown_gateway_error">Unknown Gateway Error</option>
                </select>
              </div>

              <div className="sim-form-group">
                <label className="sim-label">Amount (₹):</label>
                <input
                  type="number"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="sim-text-input"
                  min="100"
                  max="100000"
                />
              </div>

              <div className="sim-form-group">
                <label className="sim-label">Customer Name:</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="sim-text-input"
                />
              </div>

              <div className="sim-form-group">
                <label className="sim-label">Customer Email:</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="sim-text-input"
                />
              </div>
            </div>

            <div className="sim-actions-row">
              <button type="submit" className="btn-execute-primary" disabled={simulating}>
                {simulating ? 'Processing AI Pipeline...' : '⚡ Trigger Live Payment Failure'}
              </button>
              <button type="button" className="btn-secondary-luxury" onClick={onClose}>
                Cancel / Go Back
              </button>
            </div>
          </form>

          {error && <div className="error-banner">⚠️ {error}</div>}

          {/* Simulation Output Pipeline Snapshot */}
          {snapshot && (
            <div className="sim-snapshot-card">
              <h4 className="snap-header-title">✅ Live AI Pipeline Execution Snapshot</h4>
              
              <div className="snapshot-cards-grid">
                <div className="snap-item-card">
                  <span className="snap-title">1. Risk Engine</span>
                  <strong className="snap-value">{snapshot.risk_engine?.riskScore}/100 ({snapshot.risk_engine?.riskLevel})</strong>
                </div>

                <div className="snap-item-card">
                  <span className="snap-title">2. AI Diagnosis Agent</span>
                  <strong className="snap-value text-violet">{snapshot.ai_diagnosis?.ai_diagnosis?.diagnosis || 'DIAGNOSED'}</strong>
                </div>

                <div className="snap-item-card">
                  <span className="snap-title">3. Decision Engine</span>
                  <strong className="snap-value text-cyan">{snapshot.decision_engine?.decision?.final_action || 'PAYMENT_LINK'}</strong>
                </div>

                <div className="snap-item-card">
                  <span className="snap-title">4. Guardrail Check</span>
                  <span className={`badge ${snapshot.guardrail_engine?.guardrail_result?.requires_human_approval ? 'badge-risk-high' : 'badge-status-recovered'}`}>
                    {snapshot.guardrail_engine?.guardrail_result?.requires_human_approval ? 'APPROVAL REQUIRED' : 'ALLOWED'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer-luxury">
          <button className="btn-secondary-luxury" onClick={onClose}>Close Simulator</button>
        </div>
      </div>
    </div>
  );
}
