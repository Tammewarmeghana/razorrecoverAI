import fetch from 'node-fetch';

async function checkLivePipelineVerification() {
  const serverUrl = 'http://localhost:5000';
  const targetCaseId = '73b5980a-4273-473a-88f6-e0e9cda7d69a';
  const paymentId = 'TUOdwKLZOS314n';

  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - LIVE END-TO-END VERIFICATION      ');
  console.log('======================================================\n');

  // Fetch Recovery Case from Live Server
  const caseRes = await fetch(`${serverUrl}/api/recovery-cases/${targetCaseId}`);
  const caseData = (await caseRes.json()).data;

  // Fetch Audit Logs
  const auditRes = await fetch(`${serverUrl}/api/audit-logs?limit=50`);
  const auditData = (await auditRes.json()).data;

  // Fetch Metrics
  const metricsRes = await fetch(`${serverUrl}/api/metrics`);
  const metricsData = (await metricsRes.json()).data;

  const recoveryAudit = auditData.find(a => 
    a.recovery_case_id === targetCaseId && 
    (a.event_type === 'REVENUE_RECOVERED' || a.event_type === 'WEBHOOK_PAYMENT_CAPTURED')
  );

  console.log(`- Target Case ID          : ${targetCaseId}`);
  console.log(`- Payment ID              : ${paymentId}`);
  console.log(`- Current Case Status     : ${caseData.status}`);
  console.log(`- Amount Recovered Paise  : ${caseData.amount_recovered_paise} (₹${caseData.amount_recovered_rupees})`);
  console.log(`- Audit Log Result        : ${recoveryAudit ? recoveryAudit.event_type : 'NONE'}`);
  console.log(`- Total Recovered Revenue : ₹${metricsData.recovered_revenue_rupees}`);
  console.log(`- Successful Recoveries   : ${metricsData.successful_recoveries}`);
  console.log('======================================================\n');
}

checkLivePipelineVerification().catch(console.error);
