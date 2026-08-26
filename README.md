# RazorRecover AI

> **Autonomous AI Revenue Recovery Engine for Razorpay**  
> *Built for Razorpay AI Buildathon — Track: Autonomous AI Revenue Recovery*

---

## 1. Project Name
**RazorRecover AI**

---

## 2. One-Line Description
An autonomous, production-ready AI revenue recovery platform that combines deterministic risk scoring, Gemini LLM failure diagnosis, policy decision rules, and 10 safety guardrails to recover failed Razorpay payments automatically.

---

## 3. Problem
Online merchants lose between 5% and 15% of their recurring revenue to payment failures—including transient gateway timeouts, customer OTP abandonments, insufficient account balances, and expired payment cards.

---

## 4. Why The Problem Matters
Payment failures create severe cash flow loss, high customer churn, and customer support overhead. Standard payment retries rely on rigid, brute-force schedules that alienate customers, trigger fraud flags, and fail to address the specific root cause of the failure.

---

## 5. Solution
RazorRecover AI transforms payment failures into recovered revenue through a 6-step autonomous pipeline:
- **Instant Webhook Ingestion:** Ingests Razorpay payment failure webhooks with cryptographic HMAC SHA-256 validation.
- **Deterministic Risk Scoring:** Scores risk strictly from 0 to 100 based on value, failure type, customer history, and retry recency.
- **AI Failure Diagnosis:** Uses Google Gemini LLM API to classify root causes (`TRANSIENT_BANK_OR_GATEWAY_FAILURE`, `USER_ABANDONMENT`, `INSUFFICIENT_FUNDS`, `EXPIRED_CARD`, `UNKNOWN`) with confidence scores and evidence lists.
- **Recovery Decision Engine:** Matches risk scores, AI diagnoses, and merchant rules to optimal recovery strategies.
- **Guardrail Safety Engine:** Enforces 10 sequential safety rules (opt-out checks, contact limits, retry limits, and high-value $\ge$ ₹15,000 human approval gates).
- **Execution & Reconciliation:** Issues official Razorpay Test Mode Payment Links and reconciles payments upon receiving `payment.captured` webhooks.

---

## 6. Architecture Diagram

```
[ CLIENT BROWSER / REACT DASHBOARD ]  <--- (REST APIs) --->  [ EXPRESS BACKEND SERVER (Port 5000) ]
                                                                             │
                                                                (Raw Body HMAC Validation)
                                                                             │
[ RAZORPAY PLATFORM / WEBHOOKS ]       <--- (HTTPS Tunnel) ──────────────────┤
                                                                             │
                                                              (SQL Parameterized Queries)
                                                                             │
                                                                             ▼
                                                               [ POSTGRESQL DATABASE LAYER ]
```

---

## 7. Agent Workflow

```
Payment Failure Webhook Received
               ↓
    HMAC Signature Validated
               ↓
     Database Failure Logged
               ↓
Deterministic Risk Score Calculated (0-100)
               ↓
 AI Diagnosis Generated (Gemini LLM JSON Output)
               ↓
  Recovery Decision Strategy Selected
               ↓
  10-Step Guardrail Engine Evaluated
               ↓
 ┌─────────────┴─────────────┐
 │                           │
[ ALLOWED ]           [ REQUIRES HUMAN APPROVAL ]
 │                           │
 ▼                           ▼
Razorpay Payment Link     Manager Approval Queue
 │                           │
 └─────────────┬─────────────┘
               │
   Customer Pays on Razorpay Page
               ↓
 Razorpay payment.captured Webhook
               ↓
Status ➔ RECOVERED & Dashboard Metrics Updated
```

---

## 8. Technology Stack
- **Backend Framework:** Node.js, Express.js
- **Database Engine:** PostgreSQL (`pg` / `pg-mem` fallback for unit testing)
- **AI / LLM Model:** Google Gemini LLM API (`gemini-1.5-flash`) with structured JSON mode and deterministic rule emulator fallback
- **SDK Integrations:** Official Razorpay Node SDK (`razorpay`)
- **Frontend Dashboard:** React 18, Vite, CSS3 (Modern Dark-Mode Dashboard Layout)
- **Public Tunneling:** Tunnelmole / localtunnel / ngrok for public webhook delivery

---

## 9. Database Design
The PostgreSQL schema consists of 8 core tables:
1. `merchants`: Merchant accounts, retry policies, and max attempt thresholds.
2. `customers`: Customer profiles and `is_opted_out` status.
3. `transactions`: Payment attempt logs (status: `failed`, `captured`).
4. `payment_failures`: Technical failure codes, reasons, and unique `event_id` for idempotency.
5. `recovery_cases`: Central recovery case tracking (`amount_at_risk_paise`, `amount_recovered_paise`, `risk_score`, `risk_level`, `status`).
6. `agent_decisions`: AI diagnosis outputs, confidence scores, and reasoning summaries.
7. `recovery_actions`: Executed recovery actions (`CREATE_PAYMENT_LINK`, `status`, `response_data`).
8. `audit_logs`: Immutable audit ledger (`event_type`, `details`, `created_at`).

---

## 10. AI Architecture
The **AI Diagnosis Agent** operates in Phase 8:
- **Input Context:** Payment amount (rupees), error code, error reason, failure description, customer payment history count, retry count, risk score, time elapsed.
- **LLM Call:** System prompt instructs Google Gemini to respond strictly in validated JSON matching schema.
- **Schema Validation:** Strict validator (`validateAiOutput`) validates that diagnosis belongs to `ALLOWED_DIAGNOSES` and intervention belongs to `ALLOWED_INTERVENTIONS`.
- **Deterministic Fallback:** If the LLM API fails or times out, a deterministic rule engine provides 100% reliable fallback diagnosis.

---

## 11. Guardrails
The **Guardrail Safety Engine** evaluates 10 sequential safety rules prior to action execution:
1. **Case Existence Rule:** Must be a valid active recovery case.
2. **Already Recovered Check:** Prevents duplicate actions if status is already `RECOVERED`.
3. **Retry Limit Check:** `attempt_count < max_retry_attempts` (Default: 3 retries max).
4. **Contact Limit Check:** `contact_count < max_contact_count` (Default: 2 contacts max).
5. **Customer Opt-Out Check:** `customers.is_opted_out === true` $\rightarrow$ Immediate hard BLOCK.
6. **Valid Action Check:** Action must be in allowed intervention list.
7. **Required Data Check:** Customer contact info must be non-null.
8. **High-Value Human Approval Gate:** Amount $\ge$ ₹15,000 halts automatic link creation and routes case to Manager Approval Queue.
9. **Unknown Diagnosis Gate:** `UNKNOWN` diagnosis requires manager approval.
10. **Merchant Policy Check:** Strategy must be enabled by merchant rules.

---

## 12. Razorpay Integration
- Uses official Razorpay Node SDK (`new Razorpay({ key_id, key_secret })`).
- Payment Link creation calls `razorpay.paymentLink.create()` passing `notes: { recovery_case_id }`.
- Preserves real Razorpay TEST MODE credentials (`rzp_test_...`).
- Strictly keeps API key secrets on the backend server.

---

## 13. Webhook Handling
- **Endpoint:** `POST /api/webhooks/razorpay`
- **Signature Verification:** Computes HMAC SHA-256 hash over raw body buffer (`req.rawBody`) using `RAZORPAY_WEBHOOK_SECRET` and verifies against `x-razorpay-signature` header.
- **Idempotency:** Reads `x-razorpay-event-id`. If event ID was previously processed, returns HTTP 200 `{ status: 'duplicate' }` without double-counting metrics.
- **Reconciliation:** On `payment.captured`, matches `payment_link_id` or case ID, transitions case status to `RECOVERED`, updates `amount_recovered_paise`, and logs `REVENUE_RECOVERED` audit event.

---

## 14. Evaluation Methodology
System performance is evaluated using automated test scripts covering unit math, API integration, AI schema validation, guardrail safety enforcement, duplicate protection, and webhook signature verification.

---

## 15. Actual Evaluation Results
The complete automated test suite was executed against the system:

```text
======================================================
   RAZORRECOVER AI AUTOMATED TEST SUITE SUMMARY       
======================================================
• Phase 7 Risk Engine Test Suite        : 13 / 13 PASSED
• Phase 8 AI Diagnosis Test Suite       : 13 / 13 PASSED
• Phase 9 Decision Engine Test Suite    : 16 / 16 PASSED
• Phase 10 Guardrail Safety Test Suite  : 28 / 28 PASSED
• Phase 11 Payment Link Execution Suite : 18 / 18 PASSED
• Phase 12 Webhook Ingestion Suite      :  8 /  8 PASSED
• Phase 14 Simulator & Approvals Suite  :  8 /  8 PASSED
======================================================
  TOTAL TEST SUITE RESULTS              : 104 / 104 PASSED
======================================================
```

---

## 16. Screenshots Section

Below are high-resolution screenshots of the RazorRecover AI Merchant Dashboard:

### 1. KPI Metrics Banner & Active Cases Table
![KPI Metrics & Dashboard](file:///C:/Users/tamme/.gemini/antigravity/brain/32696911-c12a-4313-ba4b-03184682ce49/.user_uploaded/media_1787748640362.png)

### 2. 6-Step Visual Pipeline & Case Intelligence Inspector
![Case Inspector & AI Pipeline](file:///C:/Users/tamme/.gemini/antigravity/brain/32696911-c12a-4313-ba4b-03184682ce49/.user_uploaded/media_1787749449369.png)

### 3. Official Razorpay Test Payment Link & Action Panel
![Razorpay Payment Link Execution](file:///C:/Users/tamme/.gemini/antigravity/brain/32696911-c12a-4313-ba4b-03184682ce49/.user_uploaded/media_1787749624517.png)

### 4. Real Webhook-Recovered ₹499 Case & Audit Stream
![Real Webhook Recovered Case](file:///C:/Users/tamme/.gemini/antigravity/brain/32696911-c12a-4313-ba4b-03184682ce49/.user_uploaded/media_1787749854891.png)

---

## 17. Local Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) or Node `pg-mem` fallback

### Installation Commands

```bash
# Clone the repository
git clone https://github.com/your-username/razorrecover-ai.git
cd razorrecover-ai

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

---

## 18. Environment Variables

Create `server/.env` based on `.env.example`:

```env
PORT=5000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=razorrecover_db

RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_SECRET_KEY
RAZORPAY_WEBHOOK_SECRET=razorrecover_webhook_secret_2026
```

---

## 19. Running The Project

### Start Backend Server
```bash
cd server
npm start
```
*Backend API available at `http://localhost:5000`.*

### Start Frontend Dashboard
```bash
cd client
npm run dev
```
*Frontend UI available at `http://localhost:5173`.*

---

## 20. Testing

Run backend test suites:

```bash
cd server

# Risk Engine Tests
npm run test:risk

# AI Diagnosis Tests
npm run test:ai

# Decision Engine Tests
npm run test:decision

# Guardrail Safety Tests
npm run test:guardrail

# Payment Link Execution Tests
npm run test:execution

# Webhook Ingestion Tests
npm run test:phase12

# Simulator & Human Approvals Tests
npm run test:phase14
```

---

## 21. Known Limitations
1. **Webhook Delivery in Local Dev:** Requires a public HTTPS tunnel (Tunnelmole, ngrok, or localtunnel) to route webhooks from Razorpay Test Mode servers to `http://localhost:5000/api/webhooks/razorpay`.
2. **Channel Dispatch:** Currently focuses on Razorpay 1-click Payment Link creation; SMS and WhatsApp dispatches are represented via structured JSON payloads.

---

## 22. Future Improvements
1. **Multi-Channel Dispatch:** Direct integration with WhatsApp Business API and Twilio SMS.
2. **Custom Merchant Guardrail Policy Editor:** UI controls allowing merchants to customize risk score weights and approval thresholds.
3. **Predictive Recovery ML:** Train custom ML models on merchant historical recovery data to optimize payment retry timing windows.
