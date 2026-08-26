import fetch from 'node-fetch';

async function runPhase14SimulatorTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 14 AUTOMATED TEST SUITE    ');
  console.log('======================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASSED: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      failedTests++;
    }
  }

  const serverUrl = 'http://localhost:5000';

  // --- Test 1: Standard Payment Failure Simulation ---
  console.log('Test 1: Standard Payment Failure Simulation (₹2,499 Insufficient Funds)');
  const sim1Res = await fetch(`${serverUrl}/api/simulation/simulate-failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_rupees: 2499,
      error_reason: 'insufficient_funds',
      customer_name: 'Hackathon Judge',
      customer_email: 'judge@hackathon.ai'
    })
  });

  const sim1Data = await sim1Res.json();
  const snapshot1 = sim1Data.data.pipeline_snapshot;

  assert(sim1Res.status === 201 && sim1Data.success === true, `Simulation API returned 201 Created`);
  assert(sim1Data.data.recovery_case_id !== undefined, `Recovery Case created (${sim1Data.data.recovery_case_id})`);
  assert(snapshot1.risk_engine.riskScore !== undefined, `Risk Engine evaluated score (${snapshot1.risk_engine.riskScore}/100)`);
  assert(snapshot1.ai_diagnosis.ai_diagnosis.diagnosis !== undefined, `AI Diagnosis Agent generated diagnosis (${snapshot1.ai_diagnosis.ai_diagnosis.diagnosis})`);

  // --- Test 2: High-Value Simulation Requiring Human Approval ---
  console.log('\nTest 2: High-Value Payment Failure Simulation (₹25,000)');
  const sim2Res = await fetch(`${serverUrl}/api/simulation/simulate-failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_rupees: 25000,
      error_reason: 'gateway_error',
      customer_name: 'Enterprise Client',
      customer_email: 'vip@enterprise.com'
    })
  });

  const sim2Data = await sim2Res.json();
  const case2Id = sim2Data.data.recovery_case_id;
  const guardrail2 = sim2Data.data.pipeline_snapshot.guardrail_engine.guardrail_result;

  assert(guardrail2.requires_human_approval === true, `High-value ₹25,000 transaction flagged requires_human_approval = true`);

  // --- Test 3: Manager Approval of Flagged High-Value Case ---
  console.log('\nTest 3: Manager Approval of Flagged High-Value Case');
  const approveRes = await fetch(`${serverUrl}/api/recovery-cases/${case2Id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const approveData = await approveRes.json();
  assert(approveRes.status === 200 && approveData.success === true, `Human Approval API returned 200 OK`);
  assert(approveData.data.data.payment_link_id.startsWith('plink_'), `Payment Link created after approval (${approveData.data.data.payment_link_id})`);

  // --- Test 4: Manager Rejection of Flagged Case ---
  console.log('\nTest 4: Manager Rejection of Flagged Case');
  const sim3Res = await fetch(`${serverUrl}/api/simulation/simulate-failure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_rupees: 30000, error_reason: 'expired_card' })
  });
  const case3Id = (await sim3Res.json()).data.recovery_case_id;

  const rejectRes = await fetch(`${serverUrl}/api/recovery-cases/${case3Id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Rejected during manager security review' })
  });

  const rejectData = await rejectRes.json();
  assert(rejectRes.status === 200 && rejectData.data.status === 'TERMINATED', `Case status set to TERMINATED after rejection`);

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase14SimulatorTestSuite().catch(err => {
  console.error('[Phase 14 Test Suite Error]', err);
  process.exit(1);
});
