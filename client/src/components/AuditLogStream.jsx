import React from 'react';

export default function AuditLogStream({ logs, loading, onRefresh }) {
  const getEventBadgeClass = (eventType) => {
    if (eventType.includes('REVENUE_RECOVERED')) return 'badge-status-recovered';
    if (eventType.includes('PAYMENT_LINK') || eventType.includes('PASSED')) return 'badge-risk-medium';
    if (eventType.includes('FAILED') || eventType.includes('BLOCKED')) return 'badge-risk-critical';
    return 'badge-status-detected';
  };

  return (
    <div className="audit-section">
      <div className="table-controls">
        <h3>📜 Real-Time Audit Log &amp; Security Stream</h3>
        <button className="btn-secondary" onClick={onRefresh} disabled={loading}>
          🔄 {loading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      <div className="table-container">
        <table className="cases-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event Type</th>
              <th>Recovery Case ID</th>
              <th>Payload Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-4">Loading audit stream...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-4">No audit logs recorded yet.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="date-cell">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getEventBadgeClass(log.event_type)}`}>
                      {log.event_type}
                    </span>
                  </td>
                  <td>
                    {log.recovery_case_id ? (
                      <code className="case-id-code">#{log.recovery_case_id.slice(0, 8)}</code>
                    ) : (
                      <span className="text-muted">System Level</span>
                    )}
                  </td>
                  <td>
                    <pre className="json-details-pre">
                      {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : log.details}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
