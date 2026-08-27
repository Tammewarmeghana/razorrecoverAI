import React from 'react';

export default function LiveActivityFeed({ logs = [], loading, onRefresh }) {
  const getEventIcon = (type) => {
    if (type.includes('REVENUE_RECOVERED')) return '💰';
    if (type.includes('AI_DIAGNOSIS')) return '🤖';
    if (type.includes('GUARDRAIL')) return '🛡️';
    if (type.includes('PAYMENT_LINK')) return '🔗';
    if (type.includes('RISK')) return '🎯';
    return '⚡';
  };

  const formatEventType = (type) => {
    if (!type) return 'System Event';
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const renderDetailPills = (details) => {
    if (!details) return null;
    let obj = details;
    if (typeof details === 'string') {
      try {
        obj = JSON.parse(details);
      } catch (e) {
        return <span className="detail-pill">{details}</span>;
      }
    }

    if (typeof obj !== 'object' || obj === null) {
      return <span className="detail-pill">{String(obj)}</span>;
    }

    const keyFields = [];
    if (obj.payment_id) keyFields.push(`Payment: ${obj.payment_id}`);
    if (obj.error_reason) keyFields.push(`Cause: ${obj.error_reason}`);
    if (obj.amount_rupees) keyFields.push(`Amount: ₹${obj.amount_rupees}`);
    else if (obj.amount_paise) keyFields.push(`Amount: ₹${obj.amount_paise / 100}`);
    if (obj.diagnosis) keyFields.push(`Diagnosis: ${obj.diagnosis}`);
    if (obj.recommended_intervention) keyFields.push(`Strategy: ${obj.recommended_intervention}`);
    if (obj.riskScore !== undefined) keyFields.push(`Risk: ${obj.riskScore}/100 (${obj.riskLevel || ''})`);
    if (obj.payment_link_url) keyFields.push(`Link Created`);

    if (keyFields.length === 0) {
      return Object.entries(obj).slice(0, 3).map(([k, v], idx) => (
        <span className="detail-pill" key={idx}>
          {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
        </span>
      ));
    }

    return keyFields.map((text, idx) => (
      <span className="detail-pill" key={idx}>{text}</span>
    ));
  };

  return (
    <div className="activity-feed-card">
      <div className="card-header-row">
        <div>
          <h3 className="section-title">📜 Audit Activity Ledger</h3>
          <p className="section-subtext">Real-time immutable audit trail recorded by backend engine</p>
        </div>
        <button className="btn-secondary-luxury" onClick={onRefresh} disabled={loading}>
          🔄 {loading ? 'Updating...' : 'Refresh Activity Stream'}
        </button>
      </div>

      <div className="activity-timeline-list">
        {loading && logs.length === 0 ? (
          <div className="text-center py-4 text-muted">Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-4 text-muted">No audit events recorded yet.</div>
        ) : (
          logs.map((log) => (
            <div className="activity-item-card" key={log.id}>
              <div className="activity-icon-badge">{getEventIcon(log.event_type)}</div>
              <div className="activity-content-group">
                <div className="activity-title-row">
                  <span className="activity-event-title">{formatEventType(log.event_type)}</span>
                  {log.recovery_case_id && (
                    <span className="badge badge-ai">Case #{log.recovery_case_id.slice(0, 8)}</span>
                  )}
                </div>
                <div className="activity-details-pills">
                  {renderDetailPills(log.details)}
                </div>
              </div>
              <div className="activity-time">
                {new Date(log.created_at).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
