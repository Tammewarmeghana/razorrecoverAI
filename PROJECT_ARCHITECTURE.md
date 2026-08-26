# RazorRecover AI — System Architecture Specification

> Detailed architectural diagram, system boundary specification, and component topology for RazorRecover AI.

---

## 1. High-Level Pipeline Flow Diagram

```
                             [ RAZORPAY PLATFORM ]
                                       │
                  (Failed Payment / Checkout Attempt)
                                       │
                                       ▼
                       [ POST /api/webhooks/razorpay ]
                                       │
                ┌──────────────────────┴──────────────────────┐
                │  Webhook Signature & Idempotency Verifier    │
                │  - HMAC SHA-256 (RAZORPAY_WEBHOOK_SECRET)   │
                │  - x-razorpay-event-id duplicate check      │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
                         [ PostgreSQL Database Layer ]
                         - Store failure in payment_failures
                         - Initialize recovery_cases (DETECTED)
                                       │
                                       ▼
                 ┌──────────────────────────────────────────┐
                 │ 1. Deterministic Revenue Risk Engine     │
                 │    - Scores 0-100 across 4 factors       │
                 │    - Maps to LOW / MED / HIGH / CRITICAL │
                 └────────────────────┬─────────────────────┘
                                      │
                                      ▼
                 ┌──────────────────────────────────────────┐
                 │ 2. AI Diagnosis Agent (Gemini LLM)       │
                 │    - Classifies failure root cause       │
                 │    - Output: JSON (Diagnosis, Confidence)│
                 └────────────────────┬─────────────────────┘
                                      │
                                      ▼
                 ┌──────────────────────────────────────────┐
                 │ 3. Recovery Decision Engine              │
                 │    - Matches strategy & merchant rules   │
                 │    - Generates proposed recovery action  │
                 └────────────────────┬─────────────────────┘
                                      │
                                      ▼
                 ┌──────────────────────────────────────────┐
                 │ 4. Guardrail Safety Engine               │
                 │    - 10 sequential safety checks         │
                 │    - Flags High-Value (≥₹15k) approval   │
                 └────────────────────┬─────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                  [ ALLOWED ]             [ REQUIRES APPROVAL ]
                         │                         │
                         ▼                         ▼
             [ Razorpay Payment Link ]   [ Manager Approval Queue ]
                         │                         │
           (Customer Test Checkout Page)   (Human Manager Approves)
                         │                         │
                         └────────────┬────────────┘
                                      │
                                      ▼
                      [ Razorpay payment.captured ]
                                      │
                         [ Webhook Reconciliation ]
                         - Case Status ➔ RECOVERED
                         - Record amount_recovered_paise
                         - Write REVENUE_RECOVERED audit log
                                      │
                                      ▼
                        [ React Merchant Dashboard ]
```

---

## 2. System Layer & Responsibility Boundaries

### Frontend Layer (`client/src`)
- **Technology:** React 18, Vite, CSS3
- **Role:** Pure presentation & merchant interaction layer.
- **Boundaries:** Connects strictly to backend REST APIs (`/api/metrics`, `/api/recovery-cases`, `/api/audit-logs`, `/api/simulation/simulate-failure`). Contains zero API credentials or business calculation logic.

### Backend API Layer (`server/src`)
- **Technology:** Node.js, Express.js
- **Role:** Business logic, AI prompt execution, risk scoring, guardrail evaluation, Razorpay SDK calls.
- **Boundaries:** Holds all secret environment variables (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`). Serves clean, sanitized JSON to frontend.

### Database Layer (`server/src/db`)
- **Technology:** PostgreSQL (`pg` / `pg-mem`)
- **Role:** Append-only audit logging, transaction history, customer profiles, case tracking.
- **Boundaries:** All monetary values stored as `BIGINT` in **paise**. All timestamps stored in `TIMESTAMPTZ`.

---

## 3. Core Database Tables Summary

1. `merchants`: Business merchant account settings & retry rules.
2. `customers`: Customer profile info and `is_opted_out` status.
3. `transactions`: Payment attempt records (status: `failed`, `captured`).
4. `payment_failures`: Technical failure details & `event_id` (UNIQUE for idempotency).
5. `recovery_cases`: Central tracker (`amount_at_risk_paise`, `amount_recovered_paise`, `risk_score`, `risk_level`, `status`).
6. `agent_decisions`: AI diagnosis outputs & strategy reasoning.
7. `recovery_actions`: Executed actions (`CREATE_PAYMENT_LINK`, `status`, `response_data`).
8. `audit_logs`: Immutable audit ledger (`event_type`, `details`, `created_at`).

---

## 4. Security Architecture Highlights

- **HMAC Verification:** Webhook payloads validated against `RAZORPAY_WEBHOOK_SECRET` over raw body buffers before parsing JSON.
- **No Secret Exposure:** Zero credentials bundled into frontend JavaScript dist files.
- **Server-Side Enforcement:** Clients cannot send arbitrary recovery amounts; execution strictly uses `recovery_cases.amount_at_risk_paise`.
