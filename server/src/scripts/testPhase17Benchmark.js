import fetch from 'node-fetch';

async function runPhase17BenchmarkTestSuite() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 17 AUTOMATED TEST SUITE    ');
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

  // --- Test 1: Fetch Merchant Policy Configuration ---
  console.log('Test 1: Fetch Merchant Policy Configuration (GET /api/merchants/config)');
  const getConfigRes = await fetch(`${serverUrl}/api/merchants/config`);
  const getConfigData = await getConfigRes.json();

  assert(getConfigRes.status === 200 && getConfigData.success === true, `Get Merchant Config returned 200 OK`);
  assert(getConfigData.data.max_retry_attempts !== undefined, `Max retry attempts defined (${getConfigData.data.max_retry_attempts})`);
  assert(getConfigData.data.high_value_threshold_rupees !== undefined, `High value threshold defined (₹${getConfigData.data.high_value_threshold_rupees})`);

  // --- Test 2: Update Merchant Policy Configuration ---
  console.log('\nTest 2: Update Merchant Policy Configuration (PUT /api/merchants/config)');
  const updateConfigRes = await fetch(`${serverUrl}/api/merchants/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_retry_attempts: 4,
      max_contact_count: 3,
      high_value_threshold_rupees: 20000
    })
  });

  const updateConfigData = await updateConfigRes.json();
  assert(updateConfigRes.status === 200 && updateConfigData.success === true, `Update Merchant Config returned 200 OK`);
  assert(updateConfigData.data.max_retry_attempts === 4, `Updated retry attempts to 4`);
  assert(updateConfigData.data.high_value_threshold_rupees === 20000, `Updated high value threshold to ₹20,000`);

  // Reset back to standard ₹15,000 default
  await fetch(`${serverUrl}/api/merchants/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_retry_attempts: 3, max_contact_count: 2, high_value_threshold_rupees: 15000 })
  });

  // --- Test 3: Fetch Real-Time Benchmark Metrics ---
  console.log('\nTest 3: Fetch Real-Time Benchmark Comparison Metrics (GET /api/metrics-benchmark)');
  const benchmarkRes = await fetch(`${serverUrl}/api/metrics-benchmark`);
  const benchmarkData = await benchmarkRes.json();

  assert(benchmarkRes.status === 200 && benchmarkData.success === true, `Get Benchmark Metrics returned 200 OK`);
  assert(benchmarkData.data.comparison.baseline_traditional.recovery_rate_percent === 12.1, `Baseline traditional rate is 12.1%`);
  assert(benchmarkData.data.comparison.razorrecover_ai.opt_out_compliance_percent === 100, `RazorRecover AI opt-out compliance is 100%`);
  assert(benchmarkData.data.comparison.razorrecover_ai.duplicate_link_protection === true, `RazorRecover AI duplicate link protection is ACTIVE`);

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED   `);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase17BenchmarkTestSuite().catch(err => {
  console.error('[Phase 17 Test Suite Error]', err);
  process.exit(1);
});
