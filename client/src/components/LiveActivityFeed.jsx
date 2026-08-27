import React from 'react';

export default function LiveActivityFeed({ logs = [], loading, onRefresh }) {
  const getBadgeClass = (eventType) => {
    if (eventType.includes('REVENUE_RECOVERED')) return 'badge-status-recovered';
    if (eventType.includes('PAYMENT_LINK') || eventType.includes('PASSED')) return 'badge-status-recovering';
    if (eventType.includes('FAILED') || eventType.includes('BLOCKED')) return 'badge-risk-critical';
    return 'badge-status-detected';
  };

  const getEventIcon = (eventType) => {
    if (eventType.includes('REVENUE_RECOVERED')) return '💰';
    if (eventType.includes('AI_DIAGNOSIS')) return '🤖';
    if (eventType.includes('GUARDRAIL')) return '🛡️';
    if (eventType.includes('PAYMENT_LINK')) return '🔗';
    if (eventType.includes('RISK')) return '🎯';
    return '⚡';
  };

  const formatDetails = (details) => {
    if (!details) return null;
    if (typeof details === 'string') {
      try {
        details = JSON.parse(details);
      } catch (e) {
        return <span className="activity-detail-snippet">{details}</span>;
      }
    }
    
    // Format object keys nicely
    return (
      <div className="activity-details-formatted">
        {Object.entries(details).slice(0, 4).map(([key, val]) => (
          <span key={key} className="detail-pill">
            <strong className="text-muted">{key}:</strong>{' '}
            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="activity-feed-card">
      <div className="card-header-row">
        <div>
          <h3 className="section-title">📜 Real-Time Security &amp; AI Audit Stream</h3>
          <p className="section-subtext">Immutable activity ledger recorded by backend engine</p>
        </div>
        <button className="btn-refresh-control" onClick={onRefresh} disabled={loading}>
          🔄 {loading ? 'Updating...' : 'Refresh Stream'}
        </button>
      </div>

      <div className="activity-timeline-list">
        {loading && logs.length === 0 ? (
          <div className="text-center py-4 text-muted">
            <div className="spinner-emerald mb-2"></div>
            Loading audit stream...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-4 text-muted">No audit events recorded yet.</div>
        ) : (
          logs.map((log) => (
            <div className="activity-item-row" key={log.id}>
              <div className="activity-icon-badge">{getEventIcon(log.event_type)}</div>
              <div className="activity-info-group">
                <div className="activity-title-line">
                  <span className={`badge ${getBadgeClass(log.event_type)}`}>
                    {log.event_type}
                  </span>
                  {log.recovery_case_id && (
                    <code className="case-id-code">Case #{log.recovery_case_id.slice(0, 8)}</code>
                  )}
                </div>
                {formatDetails(log.details)}
              </div>
              <div className="activity-time-stamp">
                {new Date(log.created_at).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
