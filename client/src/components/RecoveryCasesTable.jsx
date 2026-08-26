import React from 'react';

export default function RecoveryCasesTable({
  cases,
  loading,
  filters,
  onFilterChange,
  onSelectCase,
  onRefresh
}) {
  const getRiskBadgeClass = (level) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL': return 'badge-risk-critical';
      case 'HIGH': return 'badge-risk-high';
      case 'MEDIUM': return 'badge-risk-medium';
      case 'LOW': return 'badge-risk-low';
      default: return 'badge-risk-default';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toUpperCase()) {
      case 'RECOVERED': return 'badge-status-recovered';
      case 'RECOVERING': return 'badge-status-recovering';
      case 'DETECTED': return 'badge-status-detected';
      default: return 'badge-status-default';
    }
  };

  return (
    <div className="cases-section">
      <div className="table-controls">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search customer name or case ID..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="select-filter"
          >
            <option value="ALL">All Statuses</option>
            <option value="DETECTED">DETECTED (New)</option>
            <option value="RECOVERING">RECOVERING (Active)</option>
            <option value="RECOVERED">RECOVERED (Success)</option>
          </select>

          <select
            value={filters.riskLevel}
            onChange={(e) => onFilterChange('riskLevel', e.target.value)}
            className="select-filter"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">CRITICAL (80+)</option>
            <option value="HIGH">HIGH (60-79)</option>
            <option value="MEDIUM">MEDIUM (40-59)</option>
            <option value="LOW">LOW (&lt; 40)</option>
          </select>

          <button className="btn-secondary" onClick={onRefresh} disabled={loading}>
            🔄 {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="cases-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Failure Error</th>
              <th>Amount</th>
              <th>Risk Level &amp; Score</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && cases.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-4">Loading recovery cases...</td>
              </tr>
            ) : cases.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-4">No matching recovery cases found.</td>
              </tr>
            ) : (
              cases.map((c) => {
                const riskLevel = c.risk?.risk_level || 'LOW';
                const riskScore = c.risk?.risk_score ?? 0;

                return (
                  <tr key={c.id} className={c.status === 'RECOVERED' ? 'row-recovered' : ''}>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-name">{c.customer?.name || 'Valued Customer'}</span>
                        <span className="customer-sub">{c.customer?.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="error-reason-code">
                        {c.failure_details?.error_reason || 'payment_failed'}
                      </span>
                    </td>
                    <td>
                      <span className="amount-cell">₹{c.amount_at_risk_rupees}</span>
                    </td>
                    <td>
                      <div className="risk-cell">
                        <span className={`badge ${getRiskBadgeClass(riskLevel)}`}>
                          {riskLevel} ({riskScore}/100)
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <span className="date-cell">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <button className="btn-primary-sm" onClick={() => onSelectCase(c)}>
                        Inspect Case ➔
                      </button>
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
