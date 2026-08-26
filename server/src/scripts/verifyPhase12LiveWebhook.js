import { query } from '../db/index.js';

async function checkLiveStatus() {
  const caseId = '73b5980a-4273-473a-88f6-e0e9cda7d69a';
  const paymentLinkId = 'plink_TUOM1cH4cU0ISm';
  const razorpayPaymentId = 'TUOdwKLZOS314n';

  console.log('\n======================================================');
  console.log('   PHASE 12 LIVE WEBHOOK VERIFICATION INSPECTION       ');
  console.log('======================================================\n');

  // Fetch Recovery Case
  const caseRes = await query(`
    SELECT id, status, amount_at_risk_paise, amount_recovered_paise, recovery_link_id, recovery_link_url, updated_at
    FROM recovery_cases 
    WHERE id = $1;
  `, [caseId]);

  console.log('--- Recovery Case Database Record ---');
  console.table(caseRes.rows);

  // Fetch Audit Logs
  const auditRes = await query(`
    SELECT id, event_type, details, created_at
    FROM audit_logs
    WHERE recovery_case_id = $1 OR details->>'payment_id' = $2 OR details->>'payment_link_id' = $3
    ORDER BY created_at DESC;
  `, [caseId, razorpayPaymentId, paymentLinkId]);

  console.log('\n--- Associated Audit Logs ---');
  console.table(auditRes.rows);

  // Fetch Transactions
  const txRes = await query(`
    SELECT id, razorpay_payment_id, status, amount_paise, created_at
    FROM transactions
    WHERE razorpay_payment_id = $1 OR razorpay_payment_id LIKE '%TUOdwKLZOS314n%';
  `, [razorpayPaymentId]);

  console.log('\n--- Associated Transactions ---');
  console.table(txRes.rows);

  // Fetch Recovery Actions
  const actionRes = await query(`
    SELECT id, action_type, status, response_data, executed_at
    FROM recovery_actions
    WHERE recovery_case_id = $1;
  `, [caseId]);

  console.log('\n--- Recovery Actions ---');
  console.table(actionRes.rows);
}

checkLiveStatus().catch(console.error);
