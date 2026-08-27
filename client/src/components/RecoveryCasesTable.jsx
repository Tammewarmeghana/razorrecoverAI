import React from 'react';

export default function RecoveryCasesTable({
  cases = [],
  loading,
  filters,
  onFilterChange,
  onSelectCase,
  onRefresh
}) {
  // Client-side instant search & filter evaluation
  const searchLower = (filters.search || '').toLowerCase().trim();

  const filteredCases = cases.filter((c) => {
    // 1. Search text filter (Name, Email, Case ID, Error Code)
    if (searchLower) {
      const nameMatch = c.customer?.name?.toLowerCase().includes(searchLower);
      const emailMatch = c.customer?.email?.toLowerCase().includes(searchLower);
      const idMatch = c.id?.toLowerCase().includes(searchLower);
      const errorMatch = (c.error_reason || c.payment_failure?.error_reason || '').toLowerCase().includes(searchLower);

      if (!nameMatch && !emailMatch && !idMatch && !errorMatch) {
        return false;
      }
    }

    // 2. Status filter
    if (filters.status && filters.status !== 'ALL') {
      if (c.status !== filters.status) return false;
    }

    // 3. Risk Level filter
    if (filters.riskLevel && filters.riskLevel !== 'ALL') {
      const level = c.risk?.risk_level || c.risk_level || 'LOW';
      if (level.toUpperCase() !== filters.riskLevel.toUpperCase()) return false;
    }

    return true;
  });

  return (
    <div className="cases-section-container">
      {/* Controls Bar Above Table */}
      <div className="table-controls-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search customer name, email, or case ID..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="search-control-input"
          />
          {filters.search && (
            <button
              className="btn-clear-search"
              onClick={() => onFilterChange('search', '')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filters-control-group">
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="select-filter-control"
          >
            <option value="ALL">All Statuses</option>
            <option value="DETECTED">DETECTED</option>
            <option value="RECOVERING">RECOVERING</option>
            <option value="RECOVERED">RECOVERED</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>

          <select
            value={filters.riskLevel}
            onChange={(e) => onFilterChange('riskLevel', e.target.value)}
            className="select-filter-control"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <button className="btn-refresh-control" onClick={onRefresh} disabled={loading}>
            🔄 {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-container-luxury">
        <table className="cases-table-luxury">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Failure Error</th>
              <th>Amount</th>
              <th>Risk Score &amp; Level</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && cases.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-5 text-center text-muted">
                  <div className="spinner-emerald mb-2"></div>
                  Loading active recovery cases...
                </td>
              </tr>
            ) : filteredCases.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-5 text-center text-muted">
                  {searchLower ? `No recovery cases matching "${filters.search}"` : 'No matching recovery cases found.'}
                </td>
              </tr>
            ) : (
              filteredCases.map((c) => {
                const isRecovered = c.status === 'RECOVERED';
                const isRecovering = c.status === 'RECOVERING';
                const riskLevel = c.risk?.risk_level || c.risk_level || 'LOW';
                const riskScore = c.risk?.risk_score !== undefined ? c.risk.risk_score : (c.risk_score || 0);
                const riskBadgeClass = riskLevel === 'CRITICAL' ? 'badge-risk-critical' :
                                      riskLevel === 'HIGH' ? 'badge-risk-high' :
                                      riskLevel === 'MEDIUM' ? 'badge-risk-medium' : 'badge-risk-low';
                const errorReason = c.error_reason || c.payment_failure?.error_reason || 'payment_failed';
                const amountRupees = c.amount_at_risk_rupees || (c.amount_at_risk_paise / 100).toFixed(2);

                return (
                  <tr key={c.id} className={isRecovered ? 'row-recovered' : ''}>
                    <td>
                      <div className="customer-cell">
                        <span className="customer-name">{c.customer?.name || 'Valued Customer'}</span>
                        <span className="customer-sub">{c.customer?.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="error-reason-code">
                        {errorReason}
                      </span>
                    </td>
                    <td>
                      <span className={`amount-cell ${isRecovered ? 'text-emerald' : ''}`}>
                        ₹{amountRupees}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${riskBadgeClass}`}>
                        {riskLevel} ({riskScore}/100)
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${isRecovered ? 'badge-status-recovered' : isRecovering ? 'badge-status-recovering' : 'badge-status-detected'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <span className="date-cell">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-inspect-action"
                        onClick={() => onSelectCase(c)}
                      >
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
