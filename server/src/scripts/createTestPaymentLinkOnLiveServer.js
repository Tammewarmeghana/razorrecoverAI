import fetch from 'node-fetch';

async function createTestLink() {
  const serverUrl = 'http://localhost:5000';

  console.log('\n======================================================');
  console.log('   RAZORPAY TEST LINK GENERATOR FOR LIVE WEBHOOK TEST  ');
  console.log('======================================================\n');

  // 1. Fetch available cases
  const listRes = await fetch(`${serverUrl}/api/recovery-cases?limit=20`);
  const listData = await listRes.json();

  const caseItem = listData.data.find(c => c.status === 'DETECTED' && parseInt(c.amount_at_risk_paise, 10) < 1500000);

  if (!caseItem) {
    console.error('No suitable case found.');
    process.exit(1);
  }

  const caseId = caseItem.id;

  // 2. Call Execute endpoint
  const execRes = await fetch(`${serverUrl}/api/recovery-cases/${caseId}/execute`, { method: 'POST' });
  const execData = await execRes.json();

  if (!execData.success) {
    console.error('Execution failed:', execData);
    process.exit(1);
  }

  console.log(`Target Recovery Case ID : ${caseId}`);
  console.log(`Customer Name           : ${caseItem.customer.name}`);
  console.log(`Amount                  : ₹${caseItem.amount_at_risk_rupees} (${caseItem.amount_at_risk_paise} paise)`);
  console.log(`Case Status BEFORE      : ${caseItem.status}`);
  console.log(`Case Status AFTER Exec  : RECOVERING`);
  console.log(`Razorpay Payment Link ID: ${execData.data.payment_link_id}`);
  console.log(`Razorpay Short URL      : ${execData.data.payment_link_url}`);
  console.log('======================================================\n');
}

createTestLink().catch(console.error);
