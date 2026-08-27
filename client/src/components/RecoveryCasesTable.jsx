import React from 'react';

export default function RecoveryCasesTable({
  cases = [],
  loading,
  filters,
  onFilterChange,
  onSelectCase,
  onRefresh
}) {
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
            ) : cases.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-5 text-center text-muted">
                  No matching recovery cases found.
                </td>
              </tr>
            ) : (
              cases.map((c) => {
                const isRecovered = c.status === 'RECOVERED';
                const isRecovering = c.status === 'RECOVERING';
                const riskLevel = c.risk_level || 'LOW';
                const riskBadgeClass = riskLevel === 'CRITICAL' ? 'badge-risk-critical' :
                                      riskLevel === 'HIGH' ? 'badge-risk-high' :
                                      riskLevel === 'MEDIUM' ? 'badge-risk-medium' : 'badge-risk-low';

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
                        {c.payment_failure?.error_reason || 'payment_failed'}
                      </span>
                    </td>
                    <td>
                      <span className={`amount-cell ${isRecovered ? 'text-emerald' : ''}`}>
                        ₹{c.amount_at_risk_rupees}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${riskBadgeClass}`}>
                        {riskLevel} ({c.risk_score || 0}/100)
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
