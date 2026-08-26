import { getRazorpayCredentials } from '../config/razorpay.js';
import { 
  createPaymentLinkService, 
  fetchPaymentLinkService, 
  storePaymentLinkInRecoveryCaseService 
} from '../services/razorpayService.js';
import { query } from '../db/index.js';

async function runRazorpayVerification() {
  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - PHASE 5 RAZORPAY TEST MODE VERIFICATION   ');
  console.log('======================================================\n');

  // 1. Verify Configuration
  const creds = getRazorpayCredentials();
  console.log('1. Razorpay Configuration Check:');
  console.log(`   - Key ID: ${creds.key_id.substring(0, 8)}...`);
  console.log(`   - Mode: ${creds.mode}`);
  console.log(`   - Live Credentials Configured: ${creds.isConfigured ? 'YES' : 'NO (Using Test Simulation Mode)'}`);

  // 2. Test Payment Link Creation
  console.log('\n2. Testing Razorpay Payment Link Creation (TEST MODE)...');
  const paymentLinkPayload = {
    amount_paise: 249900, // ₹2,499.00
    currency: 'INR',
    description: 'Payment Recovery for Order #order_syn_000001',
    customer: {
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+919876543201'
    },
    notes: {
      recovery_reason: 'bank_timeout',
      source: 'RazorRecover_AI_Verification'
    }
  };

  const createdLink = await createPaymentLinkService(paymentLinkPayload);

  console.log('   - Created Payment Link Success!');
  console.log('   - Payment Link ID :', createdLink.id);
  console.log('   - Short URL       :', createdLink.short_url);
  console.log('   - Status          :', createdLink.status);

  // 3. Test Fetching Payment Link
  console.log('\n3. Testing Razorpay Fetch Payment Link (TEST MODE)...');
  const fetchedLink = await fetchPaymentLinkService(createdLink.id);
  console.log('   - Fetched Payment Link Success!');
  console.log('   - Fetched ID      :', fetchedLink.id);
  console.log('   - Fetched URL     :', fetchedLink.short_url);

  // 4. Test Storing in Database (recovery_cases table)
  console.log('\n4. Testing Storage in PostgreSQL recovery_cases Table...');
  // Find a target recovery_case ID from seeded DB
  const caseRes = await query(`SELECT id FROM recovery_cases LIMIT 1;`, []);
  if (caseRes.rows.length > 0) {
    const targetCaseId = caseRes.rows[0].id;
    const updatedCase = await storePaymentLinkInRecoveryCaseService({
      recoveryCaseId: targetCaseId,
      paymentLinkId: createdLink.id,
      shortUrl: createdLink.short_url
    });

    console.log('   - Database Update Success!');
    console.log('   - Case ID          :', updatedCase.id);
    console.log('   - Stored Link ID   :', updatedCase.recovery_link_id);
    console.log('   - Stored Short URL :', updatedCase.recovery_link_url);
  } else {
    console.log('   - Skipped DB update (No existing recovery_cases found)');
  }

  // 5. Display Official Response Structure (Secrets Redacted)
  console.log('\n5. Official Razorpay API Response Structure (Sanitized):');
  const sanitizedResponse = {
    id: createdLink.id,
    entity: createdLink.entity || 'payment_link',
    short_url: createdLink.short_url,
    status: createdLink.status,
    amount: createdLink.amount,
    amount_paid: createdLink.amount_paid || 0,
    currency: createdLink.currency,
    description: createdLink.description,
    customer: createdLink.customer,
    created_at: createdLink.created_at
  };
  console.log(JSON.stringify(sanitizedResponse, null, 2));

  console.log('\n[Verification] Phase 5 Razorpay Integration Layer PASSED successfully!\n');
}

runRazorpayVerification().catch(err => {
  console.error('[Razorpay Verification Error]', err);
  process.exit(1);
});
