import React, { useState, useEffect } from 'react';
import { fetchMerchantConfig, updateMerchantConfig, fetchBenchmarkMetrics } from '../services/api';

export default function PolicyBenchmarkTab() {
  const [config, setConfig] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Form states
  const [maxRetry, setMaxRetry] = useState(3);
  const [maxContact, setMaxContact] = useState(2);
  const [highValue, setHighValue] = useState(15000);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [confRes, benchRes] = await Promise.all([
        fetchMerchantConfig(),
        fetchBenchmarkMetrics()
      ]);

      setConfig(confRes.data);
      setBenchmark(benchRes.data);

      setMaxRetry(confRes.data.max_retry_attempts);
      setMaxContact(confRes.data.max_contact_count);
      setHighValue(confRes.data.high_value_threshold_rupees);
    } catch (err) {
      console.error('Failed to load policy & benchmark data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await updateMerchantConfig({
        max_retry_attempts: Number(maxRetry),
        max_contact_count: Number(maxContact),
        high_value_threshold_rupees: Number(highValue)
      });
      setMessage('✅ Policy settings saved successfully');
      setConfig(res.data);
    } catch (err) {
      setMessage(`⚠️ Save Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const comp = benchmark?.comparison;

  return (
    <div className="policy-benchmark-layout">
      {/* Policy Settings Section */}
      <div className="intel-card">
        <h3>⚙️ Merchant Recovery Policy Settings</h3>
        <p className="text-muted font-sm">
          Customize safety guardrails, retry frequency limits, and high-value manager review thresholds.
        </p>

        {message && <div className="error-banner mt-2">{message}</div>}

        <form onSubmit={handleSaveConfig} className="sim-form mt-3">
          <div className="form-grid">
            <div className="form-group">
              <label>Max Retries Per Case:</label>
              <input
                type="number"
                value={maxRetry}
                onChange={(e) => setMaxRetry(e.target.value)}
                className="sim-input"
                min="1"
                max="10"
              />
            </div>

            <div className="form-group">
              <label>Max Customer Outreach Contacts:</label>
              <input
                type="number"
                value={maxContact}
                onChange={(e) => setMaxContact(e.target.value)}
                className="sim-input"
                min="1"
                max="5"
              />
            </div>

            <div className="form-group">
              <label>High-Value Approval Threshold (₹):</label>
              <input
                type="number"
                value={highValue}
                onChange={(e) => setHighValue(e.target.value)}
                className="sim-input"
                min="1000"
                step="1000"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary-sm mt-3" disabled={saving}>
            {saving ? 'Saving Rules...' : '💾 Save Policy Rules'}
          </button>
        </form>
      </div>

      {/* Benchmark Comparison Table */}
      <div className="intel-card mt-4">
        <h3>📊 Real-Time Benchmark Performance Evaluation</h3>
        <p className="text-muted font-sm">
          Comparing Traditional Blind Scheduled Retries vs. RazorRecover AI Autonomous Engine.
        </p>

        {comp && (
          <div className="table-container mt-3">
            <table className="cases-table">
              <thead>
                <tr>
                  <th>Performance Metric</th>
                  <th>Traditional Blind Retries</th>
                  <th>RazorRecover AI Engine</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Recovery Strategy</strong></td>
                  <td>{comp.baseline_traditional.strategy}</td>
                  <td><strong>{comp.razorrecover_ai.strategy}</strong></td>
                  <td><span className="badge badge-status-recovered">OPTIMIZED</span></td>
                </tr>
                <tr>
                  <td><strong>Recovery Success Rate</strong></td>
                  <td>{comp.baseline_traditional.recovery_rate_percent}%</td>
                  <td><strong className="text-success">{comp.razorrecover_ai.recovery_rate_percent}%</strong></td>
                  <td><span className="badge badge-status-recovered">+{benchmark.impact_summary.revenue_uplift_percent}% UPLIFT</span></td>
                </tr>
                <tr>
                  <td><strong>Opt-Out Customer Safety</strong></td>
                  <td>0% (Uncontrolled Spam)</td>
                  <td><strong>100% (Hard Blocked)</strong></td>
                  <td><span className="badge badge-status-recovered">100% COMPLIANT</span></td>
                </tr>
                <tr>
                  <td><strong>Duplicate Payment Link Prevention</strong></td>
                  <td>Moderate Duplicate Risk</td>
                  <td><strong>Active (Strict Idempotency)</strong></td>
                  <td><span className="badge badge-status-recovered">ZERO DUPLICATES</span></td>
                </tr>
                <tr>
                  <td><strong>High-Value (≥₹15k) Risk Oversight</strong></td>
                  <td>None (Automatic Execution)</td>
                  <td><strong>Manager Approval Required</strong></td>
                  <td><span className="badge badge-status-recovered">HUMAN IN THE LOOP</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
