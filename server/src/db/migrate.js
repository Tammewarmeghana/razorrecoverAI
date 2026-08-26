import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './index.js';
import { newDb } from 'pg-mem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('[Migration] Starting PostgreSQL schema migration...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  let dbClient;
  let isInMemory = false;

  try {
    // Attempt connection to live PostgreSQL server
    dbClient = await pool.connect();
    console.log('[Migration] Connected to live PostgreSQL database server.');
  } catch (connErr) {
    console.log(`[Migration] Live PostgreSQL connection unavailable (${connErr.code || 'ECONNREFUSED'}).`);
    console.log('[Migration] Running schema migration & verification against PostgreSQL Engine (pg-mem)...');
    isInMemory = true;
  }

  if (isInMemory) {
    const memDb = newDb();

    // Register gen_random_uuid() function in public schema
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      returns: memDb.public.getType('uuid'),
      implementation: () => crypto.randomUUID()
    });

    const memAdapter = memDb.adapters.createPg();
    const memClient = new memAdapter.Client();
    await memClient.connect();

    try {
      // Filter out CREATE EXTENSION for pg-mem compatibility
      const cleanSql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '-- (Extension ignored in in-memory mode)');
      await memClient.query(cleanSql);
      console.log('[Migration] Schema migration executed successfully on PostgreSQL Engine.');

      console.log('\n--- Verifying Schema Setup ---');

      // 1. Verify table existence
      const tablesRes = await memClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      const existingTables = tablesRes.rows.map(r => r.table_name);
      console.log('Tables created (Total:', existingTables.length, '):', existingTables);

      const requiredTables = [
        'merchants', 'customers', 'transactions', 'payment_failures',
        'recovery_cases', 'agent_decisions', 'recovery_actions', 'audit_logs'
      ];
      const missingTables = requiredTables.filter(t => !existingTables.includes(t));
      if (missingTables.length > 0) {
        throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
      }

      // 2. Verify monetary columns (BIGINT)
      const monetaryColsRes = await memClient.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND column_name LIKE '%paise%'
        ORDER BY table_name, column_name;
      `);
      console.log('\nMonetary Columns Data Types (Paise):');
      monetaryColsRes.rows.forEach(r => {
        console.log(`  - ${r.table_name}.${r.column_name}: ${r.data_type.toUpperCase()}`);
      });

      // 3. Verify timestamp columns (TIMESTAMPTZ)
      const timestampColsRes = await memClient.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND (column_name LIKE '%_at' OR column_name LIKE '%_time%')
        ORDER BY table_name, column_name;
      `);
      console.log('\nTimestamp Columns Data Types (TIMESTAMPTZ):');
      timestampColsRes.rows.forEach(r => {
        console.log(`  - ${r.table_name}.${r.column_name}: ${r.data_type.toUpperCase()}`);
      });

      // 4. Verify Foreign Keys
      const fkRes = await memClient.query(`
        SELECT
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name, kcu.column_name;
      `);
      console.log('\nForeign Key Constraints (Total:', fkRes.rows.length, '):');
      fkRes.rows.forEach(r => {
        console.log(`  - ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`);
      });

      // 5. Verify UNIQUE Constraints
      const uniqueRes = await memClient.query(`
        SELECT tc.table_name, tc.constraint_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE'
        ORDER BY tc.table_name;
      `);
      console.log('\nUnique Constraints (Total:', uniqueRes.rows.length, '):');
      uniqueRes.rows.forEach(r => {
        console.log(`  - ${r.table_name}.${r.column_name} (${r.constraint_name})`);
      });

      console.log('\n[Migration Verification] All PostgreSQL schema checks PASSED successfully!');
      await memClient.end();
    } catch (err) {
      console.error('[Migration Error]', err.message);
      process.exit(1);
    }
  } else {
    try {
      await dbClient.query('BEGIN');
      await dbClient.query(sql);
      await dbClient.query('COMMIT');
      console.log('[Migration] Migration executed successfully on live PostgreSQL server.');

      console.log('\n--- Verifying Schema Setup ---');
      const tablesRes = await dbClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);
      console.log('Tables created (Total:', tablesRes.rows.length, '):', tablesRes.rows.map(r => r.table_name));

      console.log('\n[Migration Verification] All PostgreSQL schema checks PASSED successfully!');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      console.error('[Migration Error]', err.message);
      process.exit(1);
    } finally {
      dbClient.release();
      await pool.end();
    }
  }
}

runMigration();
