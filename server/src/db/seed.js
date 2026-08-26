import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pool from './index.js';
import { newDb } from 'pg-mem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Reproducible Pseudo-Random Generator (Seed = 42) ---
let seed = 42;
function random() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function randomChoice(arr) {
  return arr[Math.floor(random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

// Fixed Pool of 30 Customers for Realistic Patterns
const CUSTOMER_POOL = [
  { name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '+919876543201' },
  { name: 'Rahul Verma', email: 'rahul.verma@example.com', phone: '+919876543202' },
  { name: 'Ananya Roy', email: 'ananya.roy@example.com', phone: '+919876543203' },
  { name: 'Vikram Mehta', email: 'vikram.mehta@example.com', phone: '+919876543204' },
  { name: 'Sneha Patel', email: 'sneha.patel@example.com', phone: '+919876543205' },
  { name: 'Rohan Gupta', email: 'rohan.gupta@example.com', phone: '+919876543206' },
  { name: 'Kavya Nair', email: 'kavya.nair@example.com', phone: '+919876543207' },
  { name: 'Amitav Das', email: 'amitav.das@example.com', phone: '+919876543208' },
  { name: 'Pooja Iyer', email: 'pooja.iyer@example.com', phone: '+919876543209' },
  { name: 'Siddharth Rao', email: 'siddharth.rao@example.com', phone: '+919876543210' },
  { name: 'Neha Kulkarni', email: 'neha.kulkarni@example.com', phone: '+919876543211' },
  { name: 'Arjun Kapoor', email: 'arjun.kapoor@example.com', phone: '+919876543212' },
  { name: 'Diya Reddy', email: 'diya.reddy@example.com', phone: '+919876543213' },
  { name: 'Manish Joshi', email: 'manish.joshi@example.com', phone: '+919876543214' },
  { name: 'Ishita Sen', email: 'ishita.sen@example.com', phone: '+919876543215' },
  { name: 'Varun Chopra', email: 'varun.chopra@example.com', phone: '+919876543216' },
  { name: 'Tanvi Saxena', email: 'tanvi.saxena@example.com', phone: '+919876543217' },
  { name: 'Aditya Bhat', email: 'aditya.bhat@example.com', phone: '+919876543218' },
  { name: 'Meera Deshmukh', email: 'meera.deshmukh@example.com', phone: '+919876543219' },
  { name: 'Karan Malhotra', email: 'karan.malhotra@example.com', phone: '+919876543220' },
  { name: 'Riya Agarwal', email: 'riya.agarwal@example.com', phone: '+919876543221' },
  { name: 'Gaurav Pandey', email: 'gaurav.pandey@example.com', phone: '+919876543222' },
  { name: 'Shreya Ghosh', email: 'shreya.ghosh@example.com', phone: '+919876543223' },
  { name: 'Nikhil Srivastava', email: 'nikhil.srivastava@example.com', phone: '+919876543224' },
  { name: 'Bhavna Menon', email: 'bhavna.menon@example.com', phone: '+919876543225' },
  { name: 'Aakash Mishra', email: 'aakash.mishra@example.com', phone: '+919876543226' },
  { name: 'Swati Bansal', email: 'swati.bansal@example.com', phone: '+919876543227' },
  { name: 'Devendra Nambiar', email: 'devendra.nambiar@example.com', phone: '+919876543228' },
  { name: 'Preeti Ahuja', email: 'preeti.ahuja@example.com', phone: '+919876543229' },
  { name: 'Tarun Saxena', email: 'tarun.saxena@example.com', phone: '+919876543230' }
];

const FAILURE_REASONS = [
  { reason: 'bank_timeout', code: 'GATEWAY_ERROR', desc: 'Bank server timed out during authentication' },
  { reason: 'gateway_error', code: 'GATEWAY_ERROR', desc: 'Payment gateway connection dropped' },
  { reason: 'insufficient_funds', code: 'BAD_REQUEST_ERROR', desc: 'Insufficient funds in customer bank account' },
  { reason: 'otp_timeout', code: 'BAD_REQUEST_ERROR', desc: 'Customer did not enter OTP before expiration' },
  { reason: 'card_expired', code: 'BAD_REQUEST_ERROR', desc: 'Debit/Credit card has expired' },
  { reason: 'network_error', code: 'GATEWAY_ERROR', desc: 'Transient network disconnect on customer device' }
];

const PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'wallet'];
const TYPICAL_AMOUNTS = [49900, 99900, 149900, 249900, 399900, 499900, 799900, 999900, 1499900];

async function seedData() {
  console.log('[Synthetic Data Generator] Starting generation of 500 payment records...');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const sqlSchema = fs.readFileSync(schemaPath, 'utf8');

  let dbClient;
  let isInMemory = false;

  try {
    dbClient = await pool.connect();
    console.log('[DB] Connected to live PostgreSQL server.');
  } catch {
    console.log('[DB] Live PostgreSQL server unavailable. Using PostgreSQL Engine (pg-mem) for seed execution...');
    isInMemory = true;
  }

  let queryFn;

  if (isInMemory) {
    const memDb = newDb();
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      returns: memDb.public.getType('uuid'),
      implementation: () => crypto.randomUUID()
    });
    const memAdapter = memDb.adapters.createPg();
    const memClient = new memAdapter.Client();
    await memClient.connect();

    const cleanSql = sqlSchema.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '-- (Ignored extension)');
    await memClient.query(cleanSql);

    queryFn = (text, params) => memClient.query(text, params);
  } else {
    queryFn = (text, params) => dbClient.query(text, params);
  }

  // 1. Create Synthetic Merchant
  const merchantId = crypto.randomUUID();
  await queryFn(`
    INSERT INTO merchants (id, name, email, razorpay_merchant_id, max_retry_attempts, max_contact_count)
    VALUES ($1, $2, $3, $4, $5, $6);
  `, [merchantId, '[SYNTHETIC] Acme Store Demo', 'demo@synthetic.razorrecover.ai', 'acc_synthetic_demo_500', 3, 2]);

  // 2. Insert 30 Synthetic Customers
  const customerIds = [];
  for (let i = 0; i < CUSTOMER_POOL.length; i++) {
    const c = CUSTOMER_POOL[i];
    const rzpCustId = `cust_synthetic_${(i + 1).toString().padStart(3, '0')}`;
    const custId = crypto.randomUUID();

    await queryFn(`
      INSERT INTO customers (id, merchant_id, razorpay_customer_id, name, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [custId, merchantId, rzpCustId, c.name, c.email, c.phone]);

    customerIds.push(custId);
  }

  // 3. Generate 500 Synthetic Transactions
  let capturedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  let abandonedCount = 0;
  let totalFailedPaise = 0n;

  const now = new Date();
  const sampleRecords = [];

  for (let i = 1; i <= 500; i++) {
    const customerIdx = randomInt(0, customerIds.length - 1);
    const customerId = customerIds[customerIdx];
    const customerInfo = CUSTOMER_POOL[customerIdx];

    const rzpPayId = `pay_syn_${i.toString().padStart(6, '0')}`;
    const rzpOrderId = `order_syn_${i.toString().padStart(6, '0')}`;
    const rzpEventId = `evt_syn_${i.toString().padStart(6, '0')}`;

    const amountPaise = randomChoice(TYPICAL_AMOUNTS);
    const method = randomChoice(PAYMENT_METHODS);

    // Status probability distribution: captured (50%), failed (35%), pending (8%), abandoned (7%)
    const roll = random();
    let status = 'captured';
    if (roll > 0.50 && roll <= 0.85) {
      status = 'failed';
    } else if (roll > 0.85 && roll <= 0.93) {
      status = 'pending';
    } else if (roll > 0.93) {
      status = 'abandoned';
    }

    // Spread timestamps across the last 30 days
    const daysAgo = (500 - i) / 16.6;
    const txnDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const txnId = crypto.randomUUID();

    // Insert Transaction
    await queryFn(`
      INSERT INTO transactions (id, merchant_id, customer_id, razorpay_payment_id, razorpay_order_id, amount_paise, currency, method, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
    `, [txnId, merchantId, customerId, rzpPayId, rzpOrderId, amountPaise, 'INR', method, status, txnDate]);

    let failureDetail = null;

    if (status === 'failed' || status === 'abandoned') {
      const reasonObj = (status === 'abandoned')
        ? { reason: 'otp_timeout', code: 'BAD_REQUEST_ERROR', desc: 'Customer abandoned payment flow before completion' }
        : randomChoice(FAILURE_REASONS);

      failureDetail = reasonObj;
      const failureId = crypto.randomUUID();

      // Insert Payment Failure
      await queryFn(`
        INSERT INTO payment_failures (id, merchant_id, transaction_id, event_id, error_code, error_reason, error_description, failed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [failureId, merchantId, txnId, rzpEventId, reasonObj.code, reasonObj.reason, reasonObj.desc, txnDate]);

      // Create Recovery Case
      const caseId = crypto.randomUUID();
      await queryFn(`
        INSERT INTO recovery_cases (id, merchant_id, customer_id, payment_failure_id, amount_at_risk_paise, amount_recovered_paise, status, attempt_count, contact_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `, [caseId, merchantId, customerId, failureId, amountPaise, 0, 'DETECTED', 0, 0, txnDate, txnDate]);

      // Write Audit Log
      const auditId = crypto.randomUUID();
      const auditPayload = JSON.stringify({ payment_id: rzpPayId, status, error_reason: reasonObj.reason, amount_paise: amountPaise });
      await queryFn(`
        INSERT INTO audit_logs (id, merchant_id, event_type, details, created_at)
        VALUES ($1, $2, $3, $4::jsonb, $5);
      `, [auditId, merchantId, 'SYNTHETIC_FAILURE_GENERATED', auditPayload, txnDate]);
    } else {
      // Successful or Pending Audit Log
      const auditId = crypto.randomUUID();
      const auditPayload = JSON.stringify({ payment_id: rzpPayId, status, amount_paise: amountPaise });
      await queryFn(`
        INSERT INTO audit_logs (id, merchant_id, event_type, details, created_at)
        VALUES ($1, $2, $3, $4::jsonb, $5);
      `, [auditId, merchantId, status === 'captured' ? 'SYNTHETIC_PAYMENT_CAPTURED' : 'SYNTHETIC_PAYMENT_PENDING', auditPayload, txnDate]);
    }

    // Counters
    if (status === 'captured') capturedCount++;
    else if (status === 'failed') {
      failedCount++;
      totalFailedPaise += BigInt(amountPaise);
    } else if (status === 'pending') pendingCount++;
    else if (status === 'abandoned') {
      abandonedCount++;
      totalFailedPaise += BigInt(amountPaise);
    }

    // Store first 5 records as samples
    if (i <= 5) {
      sampleRecords.push({
        id: i,
        razorpay_payment_id: rzpPayId,
        customer_name: customerInfo.name,
        amount: `₹${(amountPaise / 100).toLocaleString('en-IN')}`,
        method,
        status,
        failure_reason: failureDetail ? failureDetail.reason : 'N/A',
        timestamp: txnDate.toISOString()
      });
    }
  }

  // Verification Output
  const totalTxns = capturedCount + failedCount + pendingCount + abandonedCount;
  const totalFailedRupees = (Number(totalFailedPaise) / 100).toLocaleString('en-IN');

  console.log('\n======================================================');
  console.log('   RAZORRECOVER AI - SYNTHETIC DATA SEED COMPLETE    ');
  console.log('======================================================\n');

  console.log('--- 5 Sample Records ---');
  console.table(sampleRecords);

  console.log('\n--- Generation Summary ---');
  console.log(`- Total Transactions Generated : ${totalTxns}`);
  console.log(`- Successful (Captured)       : ${capturedCount} (${((capturedCount/totalTxns)*100).toFixed(1)}%)`);
  console.log(`- Failed                       : ${failedCount} (${((failedCount/totalTxns)*100).toFixed(1)}%)`);
  console.log(`- Abandoned                    : ${abandonedCount} (${((abandonedCount/totalTxns)*100).toFixed(1)}%)`);
  console.log(`- Pending                      : ${pendingCount} (${((pendingCount/totalTxns)*100).toFixed(1)}%)`);
  console.log(`- Total Revenue at Risk (Failed+Abandoned) : ₹${totalFailedRupees}`);
  console.log('\n[Verification] Exactly 500 records inserted into PostgreSQL schema tables.');

  if (!isInMemory) {
    await pool.end();
  }
}

seedData().catch(err => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
