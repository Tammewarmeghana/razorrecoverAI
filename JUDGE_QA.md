# RazorRecover AI — Hackathon Judge Q&A Guide

> Technical & Architecture Q&A for Judges during hackathon presentation.

---

### Q1: What problem are you solving?
**Answer:**  
Businesses lose up to 15% of their recurring revenue to payment failures (insufficient funds, OTP timeouts, gateway drops, expired cards). Standard retry logic is rigid, blind to failure causes, and alienates customers. RazorRecover AI automates failure diagnosis, risk scoring, and guardrail-protected recovery using official Razorpay APIs.

---

### Q2: Why is this better than simply retrying failed payments?
**Answer:**  
Brute-force retrying fails when the issue is permanent (e.g. expired card or customer opt-out) or when it triggers fraud flags. RazorRecover AI tailors the intervention to the root cause:
- **Transient Bank Failure:** Executed as a quiet background retry when servers stabilize.
- **OTP Abandonment:** Sent as a frictionless 1-click Razorpay Payment Link.
- **Insufficient Funds:** Sent as a polite customer reminder.
- **Expired Card:** Sent as a payment details update link.

---

### Q3: Where is the AI actually used?
**Answer:**  
The AI Agent operates in **Phase 8 (AI Diagnosis Agent)**. It analyzes structured failure metadata (error codes, customer history, retry counts, time elapsed) using a prompt-engineered LLM (`gemini-1.5-flash` with structured JSON mode) to classify the root cause, assign a confidence score (0.0 to 1.0), and extract a supporting evidence list.

---

### Q4: Why do you need deterministic rules if you have AI?
**Answer:**  
Financial systems require strict predictability and explainability. We use deterministic rules for **Risk Scoring (0-100 bounded math)** and **Safety Guardrails** to guarantee that financial risk calculations and safety boundaries (like opt-outs or ₹15,000 limits) can never be hallucinated or bypassed by an LLM.

---

### Q5: How do you prevent AI hallucinations?
**Answer:**  
1. **Strict Output Validation Schema:** Every AI response is validated against controlled Enums (`ALLOWED_DIAGNOSES`, `ALLOWED_INTERVENTIONS`). Invalid outputs throw errors and trigger safe fallbacks.
2. **Deterministic Fallback Engine:** If the LLM API times out or fails schema validation, a deterministic rule engine generates safe diagnoses.
3. **Guardrail Isolation:** The AI cannot execute actions directly—it only recommends. The Guardrail Engine makes the final ALLOW/BLOCK decision.

---

### Q6: How do you prevent duplicate payment links?
**Answer:**  
We implement database-level idempotency checks in `recoveryExecutionService.js`. Before calling Razorpay's API, the backend checks if `recovery_cases.recovery_link_id` already exists. If present, it returns the existing link without making another Razorpay API call.

---

### Q7: How do you prevent excessive retries or customer spam?
**Answer:**  
The Guardrail Safety Engine enforces:
- `attempt_count < merchants.max_retry_attempts` (Default: 3 retries max)
- `contact_count < merchants.max_contact_count` (Default: 2 contacts max)
- Customer opt-out verification (`customers.is_opted_out === true` $\rightarrow$ Hard BLOCK).

---

### Q8: What happens if a customer opts out?
**Answer:**  
If `customers.is_opted_out` is `true`, Rule 5 of the Guardrail Engine triggers a hard BLOCK with reason *"Customer has opted out of recovery communication."* Zero messages or links are created.

---

### Q9: What happens for high-value transactions?
**Answer:**  
Any transaction $\ge$ ₹15,000 triggers Rule 8 of the Guardrail Engine. Automatic link creation is halted, `requires_human_approval` is set to `true`, and the case is routed to the **Manager Approval Queue** where a human manager must inspect the AI diagnosis and click **Approve** or **Reject**.

---

### Q10: How do you know the payment was actually recovered?
**Answer:**  
A case is marked `RECOVERED` **only** upon receiving and verifying an official `payment.captured` webhook from Razorpay containing a matching amount. Case status remains `RECOVERING` until Razorpay's cryptographically signed webhook arrives.

---

### Q11: How does the Razorpay webhook work?
**Answer:**  
Razorpay sends POST requests to `/api/webhooks/razorpay`. We verify the HMAC SHA-256 signature using `x-razorpay-signature` and `RAZORPAY_WEBHOOK_SECRET` over raw body buffers. We check `x-razorpay-event-id` for idempotency before processing.

---

### Q12: How do you protect Razorpay credentials?
**Answer:**  
All credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) reside exclusively in `server/.env`. They are never stored in the database, passed to the frontend, or logged in console/API outputs.

---

### Q13: What happens if Razorpay API fails or times out?
**Answer:**  
The execution service catches API exceptions, marks `recovery_actions.status = 'FAILED'`, logs an audit error event, and keeps `recovery_cases.status` at its current state without corrupting database records.

---

### Q14: What happens if the webhook is duplicated?
**Answer:**  
The Webhook Service queries `payment_failures` and `audit_logs` for `event_id`. If `event_id` exists, it logs `"Duplicate event ignored"` and returns HTTP 200 `{ status: 'duplicate' }` without modifying revenue metrics twice.

---

### Q15: How would this scale in production?
**Answer:**  
- **Message Queues:** Offload AI diagnosis and payment link generation to Redis/BullMQ background jobs.
- **Database Indexing:** Composite indexes on `(status, created_at)` and `razorpay_payment_id` support millions of rows.
- **Webhook Scaling:** Stateless Express webhook workers running behind a load balancer with Redis idempotency caches.

---

### Q16: What would you build next?
**Answer:**  
1. Multi-channel dispatch (WhatsApp Business API & email notification templates).
2. Autonomous ML model tuning for risk score weights based on historical merchant recovery rates.
3. Merchant custom guardrail policy editor UI.
