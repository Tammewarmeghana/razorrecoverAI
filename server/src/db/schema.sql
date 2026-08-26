-- RazorRecover AI - PostgreSQL Database Schema (Phase 2, Phase 3, Phase 5, Phase 7 & Phase 10)

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Merchants Table
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    razorpay_merchant_id VARCHAR(100) UNIQUE NOT NULL,
    max_retry_attempts INT NOT NULL DEFAULT 3,
    max_contact_count INT NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table (With Opt-Out Status Column)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    razorpay_customer_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_opted_out BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customers_merchant_rzp_id UNIQUE (merchant_id, razorpay_customer_id)
);

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    razorpay_payment_id VARCHAR(100) UNIQUE NOT NULL,
    razorpay_order_id VARCHAR(100) NOT NULL,
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    method VARCHAR(50) NOT NULL DEFAULT 'upi',
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Payment Failures Table
CREATE TABLE IF NOT EXISTS payment_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    event_id VARCHAR(100) UNIQUE NOT NULL,
    error_code VARCHAR(100) NOT NULL,
    error_reason VARCHAR(100) NOT NULL,
    error_description TEXT,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Recovery Cases Table (With Risk Engine Columns)
CREATE TABLE IF NOT EXISTS recovery_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    payment_failure_id UUID NOT NULL REFERENCES payment_failures(id) ON DELETE CASCADE,
    amount_at_risk_paise BIGINT NOT NULL,
    amount_recovered_paise BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'DETECTED',
    attempt_count INT NOT NULL DEFAULT 0,
    contact_count INT NOT NULL DEFAULT 0,
    recovery_link_id VARCHAR(100),
    recovery_link_url TEXT,
    risk_score INT NOT NULL DEFAULT 0,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Agent Decisions Table
CREATE TABLE IF NOT EXISTS agent_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recovery_case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    diagnosed_root_cause VARCHAR(100) NOT NULL,
    chosen_strategy VARCHAR(100) NOT NULL,
    reasoning TEXT NOT NULL,
    guardrails_passed BOOLEAN NOT NULL DEFAULT true,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Recovery Actions Table
CREATE TABLE IF NOT EXISTS recovery_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recovery_case_id UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
    agent_decision_id UUID REFERENCES agent_decisions(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    response_data JSONB,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    recovery_case_id UUID REFERENCES recovery_cases(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_merchants_rzp_id ON merchants(razorpay_merchant_id);
CREATE INDEX IF NOT EXISTS idx_customers_merchant ON customers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_rzp_payment ON transactions(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_status ON transactions(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_failures_event_id ON payment_failures(event_id);
CREATE INDEX IF NOT EXISTS idx_cases_merchant_status ON recovery_cases(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_risk_level ON recovery_cases(risk_level);
CREATE INDEX IF NOT EXISTS idx_decisions_case ON agent_decisions(recovery_case_id);
CREATE INDEX IF NOT EXISTS idx_actions_case ON recovery_actions(recovery_case_id);
CREATE INDEX IF NOT EXISTS idx_audit_merchant_event ON audit_logs(merchant_id, event_type);
