import fetch from 'node-fetch';

async function checkLivePipelineFull() {
  const serverUrl = 'http://localhost:5000';

  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - LIVE END-TO-END INSPECTION        ');
  console.log('======================================================\n');

  // Fetch Recovery Cases
  const caseRes = await fetch(`${serverUrl}/api/recovery-cases?limit=50`);
  const caseData = (await caseRes.json()).data || [];

  console.log(`Total Cases in Server: ${caseData.length}`);

  const recoveredCases = caseData.filter(c => c.status === 'RECOVERED');
  const recoveringCases = caseData.filter(c => c.status === 'RECOVERING');

  console.log(`- Status RECOVERED Count : ${recoveredCases.length}`);
  console.log(`- Status RECOVERING Count: ${recoveringCases.length}`);

  if (recoveredCases.length > 0) {
    console.log('\n--- RECOVERED Cases ---');
    console.table(recoveredCases.map(c => ({
      id: c.id,
      status: c.status,
      amount_at_risk_rupees: c.amount_at_risk_rupees,
      amount_recovered_rupees: c.amount_recovered_rupees,
      recovery_link_url: c.recovery_link_url
    })));
  }

  if (recoveringCases.length > 0) {
    console.log('\n--- RECOVERING Cases ---');
    console.table(recoveringCases.map(c => ({
      id: c.id,
      status: c.status,
      amount_at_risk_rupees: c.amount_at_risk_rupees,
      recovery_link_url: c.recovery_link_url
    })));
  }

  // Fetch Audit Logs
  const auditRes = await fetch(`${serverUrl}/api/audit-logs?limit=50`);
  const auditData = (await auditRes.json()).data || [];

  const webhookAudits = auditData.filter(a => 
    a.event_type.includes('WEBHOOK') || a.event_type.includes('REVENUE')
  );

  console.log(`\n--- Webhook & Revenue Audit Logs (Total: ${webhookAudits.length}) ---`);
  console.table(webhookAudits.map(a => ({
    id: a.id,
    event_type: a.event_type,
    case_id: a.recovery_case_id,
    details: JSON.stringify(a.details)
  })));

  // Fetch Metrics
  const metricsRes = await fetch(`${serverUrl}/api/metrics`);
  const metricsData = (await metricsRes.json()).data;

  console.log('\n--- Live System Metrics ---');
  console.table({
    total_transactions: metricsData.total_transactions,
    failed_transactions: metricsData.failed_transactions,
    successful_recoveries: metricsData.successful_recoveries,
    recovered_revenue_rupees: metricsData.recovered_revenue_rupees,
    recovery_rate_percent: metricsData.recovery_rate_percent
  });
}

checkLivePipelineFull().catch(console.error);
