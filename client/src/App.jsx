import React, { useState, useEffect } from 'react';
import { fetchMetrics, fetchRecoveryCases, fetchAuditLogs, checkHealth } from './services/api';
import MetricsOverview from './components/MetricsOverview';
import RecoveryCasesTable from './components/RecoveryCasesTable';
import CaseDetailModal from './components/CaseDetailModal';
import AuditLogStream from './components/AuditLogStream';
import JudgeDemoBar from './components/JudgeDemoBar';
import LiveSimulatorModal from './components/LiveSimulatorModal';
import HumanApprovalQueue from './components/HumanApprovalQueue';
import PolicyBenchmarkTab from './components/PolicyBenchmarkTab';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'approval' | 'policy' | 'audit'
  const [healthStatus, setHealthStatus] = useState(null);
  
  // Dashboard Data
  const [metrics, setMetrics] = useState(null);
  const [cases, setCases] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // Loading States
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: 'ALL',
    riskLevel: 'ALL',
    search: ''
  });

  // Load Health Status & Metrics on Mount
  useEffect(() => {
    loadHealth();
    loadMetrics();
    loadCases();
  }, []);

  // Reload cases when filters change
  useEffect(() => {
    loadCases();
  }, [filters.status, filters.riskLevel]);

  const loadHealth = async () => {
    try {
      const res = await checkHealth();
      setHealthStatus(res);
    } catch (err) {
      setHealthStatus({ status: 'offline', message: err.message });
    }
  };

  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetchMetrics();
      setMetrics(res.data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const loadCases = async () => {
    setLoadingCases(true);
    setError(null);
    try {
      const res = await fetchRecoveryCases({
        status: filters.status,
        riskLevel: filters.riskLevel,
        search: filters.search,
        limit: 100
      });
      setCases(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load recovery cases');
    } finally {
      setLoadingCases(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetchAuditLogs({ limit: 50 });
      setAuditLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'audit') {
      loadAuditLogs();
    }
  };

  const handleRefreshAll = () => {
    loadMetrics();
    loadCases();
    if (activeTab === 'audit') loadAuditLogs();
  };

  const pendingApprovalsCount = cases.filter(c => 
    c.status !== 'RECOVERED' && 
    c.status !== 'TERMINATED' && 
    (parseInt(c.amount_at_risk_paise || 0, 10) >= 1500000 || c.decisions?.[0]?.diagnosed_root_cause === 'UNKNOWN')
  ).length;

  return (
    <div className="app-container">
      {/* Hackathon Judge Demo Banner Bar */}
      <JudgeDemoBar
        onOpenSimulator={() => setShowSimulatorModal(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        onOpenApprovals={() => setActiveTab('approval')}
      />

      {/* Top Navbar */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <h1 className="brand-title">RazorRecover AI</h1>
            <p className="brand-subtitle">Autonomous Revenue Recovery Engine for Razorpay</p>
          </div>
        </div>

        <div className="nav-status-group">
          <div className={`status-pill ${healthStatus?.status === 'ok' ? 'online' : 'offline'}`}>
            <span className="dot"></span>
            Backend: {healthStatus?.status === 'ok' ? 'Online (Port 5000)' : 'Offline'}
          </div>
          <div className="status-pill test-mode">
            <span className="dot blue"></span>
            Razorpay: TEST MODE Active
          </div>
        </div>
      </header>

      <main className="main-layout">
        {/* KPI Summary Banner */}
        <section className="metrics-section">
          <MetricsOverview metrics={metrics} loading={loadingMetrics} />
        </section>

        {/* Global Navigation Tabs */}
        <div className="tabs-bar">
          <button
            className={`tab-btn ${activeTab === 'cases' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('cases')}
          >
            📋 Failed Recovery Cases ({cases.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'approval' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('approval')}
          >
            🛡️ Manager Approvals ({pendingApprovalsCount})
          </button>
          <button
            className={`tab-btn ${activeTab === 'policy' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('policy')}
          >
            ⚙️ Policy &amp; Benchmarks
          </button>
          <button
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('audit')}
          >
            📜 Security &amp; Audit Trail
          </button>
        </div>

        {error && (
          <div className="error-banner">
            ⚠️ {error} — <button onClick={loadCases}>Retry Loading</button>
          </div>
        )}

        {/* Main Content Area */}
        {activeTab === 'cases' && (
          <RecoveryCasesTable
            cases={cases}
            loading={loadingCases}
            filters={filters}
            onFilterChange={handleFilterChange}
            onSelectCase={(c) => setSelectedCaseId(c.id)}
            onRefresh={handleRefreshAll}
          />
        )}

        {activeTab === 'approval' && (
          <HumanApprovalQueue
            cases={cases}
            onRefresh={handleRefreshAll}
          />
        )}

        {activeTab === 'policy' && (
          <PolicyBenchmarkTab />
        )}

        {activeTab === 'audit' && (
          <AuditLogStream
            logs={auditLogs}
            loading={loadingAudit}
            onRefresh={loadAuditLogs}
          />
        )}
      </main>

      {/* Case Intelligence Inspector Modal */}
      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onCaseUpdated={handleRefreshAll}
        />
      )}

      {/* Live Failure Simulator Modal */}
      {showSimulatorModal && (
        <LiveSimulatorModal
          onClose={() => setShowSimulatorModal(false)}
          onSimulationSuccess={handleRefreshAll}
        />
      )}

      {/* Footer */}
      <footer className="footer">
        RazorRecover AI — Built for Razorpay AI Buildathon | Autonomous Revenue Recovery Track
      </footer>
    </div>
  );
}

export default App;
