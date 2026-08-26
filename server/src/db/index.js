import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { newDb } from 'pg-mem';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'razorrecover_db',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

let memClientPromise = null;

async function getMemClient() {
  if (!memClientPromise) {
    memClientPromise = (async () => {
      console.log('[DB Layer] Initializing PostgreSQL Engine (pg-mem) fallback for API layer...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      const sqlSchema = fs.readFileSync(schemaPath, 'utf8');

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

      // Seed 500 records into memory engine
      await seedInMemory(memClient);

      return memClient;
    })();
  }
  return memClientPromise;
}

// Seed helper for in-memory engine fallback
async function seedInMemory(client) {
  let seedVal = 42;
  function random() {
    seedVal = (seedVal * 9301 + 49297) % 233280;
    return seedVal / 233280;
  }
  function randomChoice(arr) { return arr[Math.floor(random() * arr.length)]; }
  function randomInt(min, max) { return Math.floor(random() * (max - min + 1)) + min; }

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
    { name: 'Siddharth Rao', email: 'siddharth.rao@example.com', phone: '+919876543210' }
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

  const merchantId = crypto.randomUUID();
  await client.query(`
    INSERT INTO merchants (id, name, email, razorpay_merchant_id, max_retry_attempts, max_contact_count)
    VALUES ($1, $2, $3, $4, $5, $6);
  `, [merchantId, '[SYNTHETIC] Acme Store Demo', 'demo@synthetic.razorrecover.ai', 'acc_synthetic_demo_500', 3, 2]);

  const customerIds = [];
  for (let i = 0; i < CUSTOMER_POOL.length; i++) {
    const c = CUSTOMER_POOL[i];
    const rzpCustId = `cust_synthetic_${(i + 1).toString().padStart(3, '0')}`;
    const custId = crypto.randomUUID();
    await client.query(`
      INSERT INTO customers (id, merchant_id, razorpay_customer_id, name, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [custId, merchantId, rzpCustId, c.name, c.email, c.phone]);
    customerIds.push(custId);
  }

  const now = new Date();

  for (let i = 1; i <= 500; i++) {
    const customerIdx = randomInt(0, customerIds.length - 1);
    const customerId = customerIds[customerIdx];

    const rzpPayId = `pay_syn_${i.toString().padStart(6, '0')}`;
    const rzpOrderId = `order_syn_${i.toString().padStart(6, '0')}`;
    const rzpEventId = `evt_syn_${i.toString().padStart(6, '0')}`;

    const amountPaise = randomChoice(TYPICAL_AMOUNTS);
    const method = randomChoice(PAYMENT_METHODS);

    const roll = random();
    let status = 'captured';
    if (roll > 0.50 && roll <= 0.85) status = 'failed';
    else if (roll > 0.85 && roll <= 0.93) status = 'pending';
    else if (roll > 0.93) status = 'abandoned';

    const daysAgo = (500 - i) / 16.6;
    const txnDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const txnId = crypto.randomUUID();

    await client.query(`
      INSERT INTO transactions (id, merchant_id, customer_id, razorpay_payment_id, razorpay_order_id, amount_paise, currency, method, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
    `, [txnId, merchantId, customerId, rzpPayId, rzpOrderId, amountPaise, 'INR', method, status, txnDate]);

    if (status === 'failed' || status === 'abandoned') {
      const reasonObj = (status === 'abandoned')
        ? { reason: 'otp_timeout', code: 'BAD_REQUEST_ERROR', desc: 'Customer abandoned payment flow before completion' }
        : randomChoice(FAILURE_REASONS);

      const failureId = crypto.randomUUID();
      await client.query(`
        INSERT INTO payment_failures (id, merchant_id, transaction_id, event_id, error_code, error_reason, error_description, failed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [failureId, merchantId, txnId, rzpEventId, reasonObj.code, reasonObj.reason, reasonObj.desc, txnDate]);

      const caseId = crypto.randomUUID();
      await client.query(`
        INSERT INTO recovery_cases (id, merchant_id, customer_id, payment_failure_id, amount_at_risk_paise, amount_recovered_paise, status, attempt_count, contact_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `, [caseId, merchantId, customerId, failureId, amountPaise, 0, 'DETECTED', 0, 0, txnDate, txnDate]);

      const auditId = crypto.randomUUID();
      const auditPayload = JSON.stringify({ payment_id: rzpPayId, status, error_reason: reasonObj.reason, amount_paise: amountPaise });
      await client.query(`
        INSERT INTO audit_logs (id, merchant_id, event_type, details, created_at)
        VALUES ($1, $2, $3, $4::jsonb, $5);
      `, [auditId, merchantId, 'SYNTHETIC_FAILURE_GENERATED', auditPayload, txnDate]);
    } else {
      const auditId = crypto.randomUUID();
      const auditPayload = JSON.stringify({ payment_id: rzpPayId, status, amount_paise: amountPaise });
      await client.query(`
        INSERT INTO audit_logs (id, merchant_id, event_type, details, created_at)
        VALUES ($1, $2, $3, $4::jsonb, $5);
      `, [auditId, merchantId, status === 'captured' ? 'SYNTHETIC_PAYMENT_CAPTURED' : 'SYNTHETIC_PAYMENT_PENDING', auditPayload, txnDate]);
    }
  }
}

export const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      const memClient = await getMemClient();
      return await memClient.query(text, params);
    }
    throw err;
  }
};

export default pool;
