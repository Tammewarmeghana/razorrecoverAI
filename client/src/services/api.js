/**
 * Centralized API Service for RazorRecover AI Frontend
 * Interacts strictly with the backend Express API server.
 * Secrets remain securely on the backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `HTTP ${response.status}: Request failed`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err.message);
    throw err;
  }
}

// System Health Check
export const checkHealth = () => request('/health');

// Dashboard Metrics & Benchmarks
export const fetchMetrics = () => request('/metrics');
export const fetchBenchmarkMetrics = () => request('/metrics-benchmark');

// Merchant Policy Configuration
export const fetchMerchantConfig = () => request('/merchants/config');
export const updateMerchantConfig = (payload) => 
  request('/merchants/config', { method: 'PUT', body: JSON.stringify(payload) });

// Recovery Cases List & Pagination
export const fetchRecoveryCases = ({ page = 1, limit = 50, status, search, riskLevel } = {}) => {
  const queryParams = new URLSearchParams();
  if (page) queryParams.append('page', page);
  if (limit) queryParams.append('limit', limit);
  if (status && status !== 'ALL') queryParams.append('status', status);
  if (search) queryParams.append('search', search);
  if (riskLevel && riskLevel !== 'ALL') queryParams.append('riskLevel', riskLevel);

  return request(`/recovery-cases?${queryParams.toString()}`);
};

// Recovery Case Details
export const fetchRecoveryCaseById = (id) => request(`/recovery-cases/${id}`);

// Engine Triggers (Phase 7-11)
export const evaluateCaseRisk = (id) => request(`/recovery-cases/${id}/evaluate-risk`, { method: 'POST' });
export const diagnoseCase = (id) => request(`/recovery-cases/${id}/diagnose`, { method: 'POST' });
export const decideCase = (id) => request(`/recovery-cases/${id}/decide`, { method: 'POST' });
export const evaluateGuardrails = (id, proposedAction) => 
  request(`/recovery-cases/${id}/guardrail-check`, {
    method: 'POST',
    body: JSON.stringify({ proposed_action: proposedAction })
  });

export const executeRecoveryAction = (id) => request(`/recovery-cases/${id}/execute`, { method: 'POST' });

// Simulation & Human Approval (Phase 14)
export const simulateFailedPayment = (payload) => 
  request('/simulation/simulate-failure', { method: 'POST', body: JSON.stringify(payload) });

export const approveHumanCase = (id) => request(`/recovery-cases/${id}/approve`, { method: 'POST' });
export const rejectHumanCase = (id, reason) => 
  request(`/recovery-cases/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

// Audit Logs Stream
export const fetchAuditLogs = ({ page = 1, limit = 50, eventType } = {}) => {
  const queryParams = new URLSearchParams();
  if (page) queryParams.append('page', page);
  if (limit) queryParams.append('limit', limit);
  if (eventType && eventType !== 'ALL') queryParams.append('eventType', eventType);

  return request(`/audit-logs?${queryParams.toString()}`);
};
