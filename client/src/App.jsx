import React, { useState, useEffect, useRef } from 'react';
import { fetchMetrics, fetchRecoveryCases, fetchAuditLogs, checkHealth } from './services/api';
import ExecutiveHeader from './components/ExecutiveHeader';
import MetricsOverview from './components/MetricsOverview';
import RecoveryFunnel from './components/RecoveryFunnel';
import AiIntelligenceAnalytics from './components/AiIntelligenceAnalytics';
import RecoveryCasesTable from './components/RecoveryCasesTable';
import CaseDetailModal from './components/CaseDetailModal';
import LiveActivityFeed from './components/LiveActivityFeed';
import LiveSimulatorModal from './components/LiveSimulatorModal';
import HumanApprovalQueue from './components/HumanApprovalQueue';
import PolicyBenchmarkTab from './components/PolicyBenchmarkTab';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'approval' | 'policy' | 'audit'
  const [healthStatus, setHealthStatus] = useState(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(null);
  
  // Dashboard Data
  const [metrics, setMetrics] = useState(null);
  const [cases, setCases] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // Loading & Connection Error States
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Modals
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: 'ALL',
    riskLevel: 'ALL',
    search: ''
  });

  // Track initial load vs polling refresh
  const initialLoadedRef = useRef(false);

  // Load Health & Data on Mount + Polling Loop (10s)
  useEffect(() => {
    loadAllData(true);

    const intervalId = setInterval(() => {
      loadAllData(false);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [filters.status, filters.riskLevel]);

  const loadAllData = async (isInitial = false) => {
    if (isInitial && !initialLoadedRef.current) {
      setLoadingMetrics(true);
      setLoadingCases(true);
    }

    try {
      const [hRes, mRes, cRes] = await Promise.all([
        checkHealth().catch(err => ({ status: 'offline', error: err.message })),
        fetchMetrics().catch(err => null),
        fetchRecoveryCases({
          status: filters.status,
          riskLevel: filters.riskLevel,
          search: filters.search,
          limit: 100
        }).catch(err => null)
      ]);

      setHealthStatus(hRes);

      if (mRes && mRes.data) {
        setMetrics(mRes.data);
      }

      if (cRes && cRes.data) {
        setCases(cRes.data);
        setConnectionError(null);
      } else if (!mRes) {
        setConnectionError('Backend API server unreachable');
      }

      setLastUpdatedTime(new Date());
      initialLoadedRef.current = true;
    } catch (err) {
      setConnectionError(err.message || 'Connection failed');
    } finally {
      setLoadingMetrics(false);
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

  const handleOpenSimulator = () => {
    setSelectedCaseId(null);
    setShowSimulatorModal(true);
  };

  const handleSelectCase = (caseObj) => {
    setShowSimulatorModal(false);
    setSelectedCaseId(caseObj.id);
  };

  const handleRefreshAll = () => {
    loadAllData(false);
    if (activeTab === 'audit') loadAuditLogs();
  };

  const pendingApprovalsCount = cases.filter(c => 
    c.status !== 'RECOVERED' && 
    c.status !== 'TERMINATED' && 
    (parseInt(c.amount_at_risk_paise || 0, 10) >= 1500000 || c.decisions?.[0]?.diagnosed_root_cause === 'UNKNOWN')
  ).length;

  return (
    <div className="app-container executive-app">
      {/* Executive Top Header */}
      <ExecutiveHeader
        healthStatus={healthStatus}
        lastUpdatedTime={lastUpdatedTime}
        onOpenSimulator={handleOpenSimulator}
        pendingApprovalsCount={pendingApprovalsCount}
        onOpenApprovals={() => setActiveTab('approval')}
        onRefresh={handleRefreshAll}
      />

      <main className="main-layout">
        {connectionError && (
          <div className="connection-warning-banner">
            ⚠️ Connection Warning: {connectionError} — Retrying in background...
          </div>
        )}

        {/* 1. Executive Metric KPI Cards */}
        <section className="metrics-section">
          <MetricsOverview metrics={metrics} loading={loadingMetrics} />
        </section>

        {/* 2. Visual Centerpieces: Autonomous Recovery Funnel & Intelligence Analytics */}
        <section className="centerpiece-grid">
          <RecoveryFunnel cases={cases} metrics={metrics} />
          <AiIntelligenceAnalytics cases={cases} />
        </section>

        {/* 3. Main Navigation Tabs */}
        <div className="tabs-bar">
          <button
            className={`tab-btn ${activeTab === 'cases' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('cases')}
          >
            📋 Recovery Cases ({cases.length})
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
            📜 Live Audit Stream
          </button>
        </div>

        {/* 4. Tab Content Panels */}
        {activeTab === 'cases' && (
          <RecoveryCasesTable
            cases={cases}
            loading={loadingCases}
            filters={filters}
            onFilterChange={handleFilterChange}
            onSelectCase={handleSelectCase}
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
          <LiveActivityFeed
            logs={auditLogs}
            loading={loadingAudit}
            onRefresh={loadAuditLogs}
          />
        )}
      </main>

      {/* Modals */}
      {selectedCaseId && (
        <CaseDetailModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onCaseUpdated={handleRefreshAll}
        />
      )}

      {showSimulatorModal && (
        <LiveSimulatorModal
          onClose={() => setShowSimulatorModal(false)}
          onSimulationSuccess={handleRefreshAll}
        />
      )}

      {/* Footer */}
      <footer className="footer">
        RazorRecover AI — Executive Autonomous Revenue Recovery Engine for Razorpay
      </footer>
    </div>
  );
}

export default App;
