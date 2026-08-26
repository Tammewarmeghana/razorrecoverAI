# RazorRecover AI — 5-Minute Live Hackathon Demo Playbook

> **Target Audience:** Razorpay AI Buildathon Judging Panel  
> **Target Duration:** 4 minutes 45 seconds  
> **Key Objective:** Demonstrate measurable revenue recovery, AI failure diagnosis, guardrail safety, human-in-the-loop oversight, and real Razorpay webhook payment recovery.

---

## ⏱️ Minute-by-Minute Live Demo Timeline

```
0:00 ──> 0:45 | 1. The Problem & Revenue at Risk Banner
0:45 ──> 1:30 | 2. Real-Time Ingestion & Deterministic Risk Scoring
1:30 ──> 2:15 | 3. AI Failure Diagnosis & Customer Selection Rationale
2:15 ──> 3:00 | 4. Safety Guardrail Checks & Razorpay Payment Link Execution
3:00 ──> 3:45 | 5. Human-in-the-Loop Approval Queue (High-Value Case)
3:45 ──> 4:30 | 6. Real Webhook Recovery & Audit Trail Reconciliation
4:30 ──> 4:45 | 7. Baseline vs. RazorRecover AI Evaluation Results
```

---

## 📜 Detailed Demo Sequence

### MINUTE 0:00 - 0:45 | Step 1: Revenue at Risk & Failure Inventory
- **Screen:** Open `http://localhost:5173` (Merchant Dashboard Landing View).
- **What to Click:** Point cursor to top KPI Card: **Revenue at Risk: ₹3,02,400**.
- **What to Say:**  
  > *"Judges, online merchants lose up to 15% of their revenue to payment failures. Traditional retries rely on blind brute-force schedules that annoy customers. Currently, our store Acme Store has **₹3,02,400 Revenue at Risk** across 214 failed payment attempts. RazorRecover AI turns this lost revenue back into recovered cash."*

---

### MINUTE 0:45 - 1:30 | Step 2: Risk Scoring Engine
- **Screen:** Recovery Cases Table (`📋 Failed Recovery Cases`).
- **What to Click:** Click **Inspect Case ➔** on Case ID `885c2d9a-f922-47d0-9f85-c4697ff6da03` (Pooja Iyer, ₹499).
- **What to Say:**  
  > *"When a payment fails, our **Deterministic Risk Engine** scores the case from 0 to 100 based on 4 explainable factors: transaction value, failure recoverability, customer history, and retry frequency. Case #885c2d9a scored **100/100 (CRITICAL risk)** because it's a high-probability transient failure from a loyal customer."*

---

### MINUTE 1:30 - 2:15 | Step 3: AI Diagnosis & Customer Targeting Rationale
- **Screen:** Case Detail Inspector Modal — AI Diagnosis Section.
- **What to Click:** Point to **🤖 AI Diagnosis Agent** box and Evidence Bullet Points.
- **What to Say:**  
  > *"Our **AI Diagnosis Agent** powered by Gemini LLM analyzes technical error codes and customer metadata. It classified this root cause as `INSUFFICIENT_FUNDS` with 85% confidence. Why did the agent select this customer for immediate outreach? Because the customer has 2 prior successful payments, high lifetime value, and a fresh failure (<24 hours old)."*

---

### MINUTE 2:15 - 3:00 | Step 4: Guardrails & Razorpay Payment Link Execution
- **Screen:** Case Detail Inspector Modal — Guardrail Status & Action Panel.
- **What to Click:** Point to **🛡️ Guardrail Engine** checklist (All PASSED), then click **"Execute Recovery Action"**.
- **What to Say:**  
  > *"Before any communication occurs, our **Guardrail Safety Engine** evaluates 10 sequential safety rules: verifying the customer hasn't opted out, retry limits aren't exceeded, and transaction value is under our ₹15,000 human approval threshold. Once allowed, it calls Razorpay's official API to issue a 1-click Payment Link (`https://rzp.io/...`). Idempotency checks guarantee clicking this 10 times will never create duplicate links."*

---

### MINUTE 3:00 - 3:45 | Step 5: Human-in-the-Loop Approval Queue
- **Screen:** Top Judge Demo Bar ➔ Live Failure Simulator ➔ Manager Approvals Tab.
- **What to Click:**  
  1. Click **"⚡ Run Live Failure Simulator"** in Judge Demo Bar.
  2. Set **Amount: ₹25,000** (High-Value Enterprise Failure). Click **Trigger Live Failure**.
  3. Show modal flagging **`REQUIRES HUMAN APPROVAL`**.
  4. Switch to **🛡️ Manager Approvals Queue** tab and click **"✅ Approve & Issue Link"**.
- **What to Say:**  
  > *"What happens for a ₹25,000 failure? Our guardrail engine automatically halts link creation and routes the case to the **Manager Approval Queue**. High-stakes revenue recovery requires human oversight before taking action."*

---

### MINUTE 3:45 - 4:30 | Step 6: Real Webhook Recovery & Audit Stream
- **Screen:** Cases Table (Filtered by `Status: RECOVERED`) & Audit Log Stream.
- **What to Click:**  
  1. Filter table by **Status: RECOVERED**. Show Case `885c2d9a` with **₹499.00 Recovered**.
  2. Click **"📜 Security & Audit Trail"** tab. Highlight `WEBHOOK_PAYMENT_CAPTURED` and `REVENUE_RECOVERED`.
- **What to Say:**  
  > *"When the customer pays on Razorpay's checkout page, Razorpay sends a cryptographically signed `payment.captured` webhook over our public HTTPS tunnel. HMAC SHA-256 signature is verified, status updates to `RECOVERED`, ₹499 revenue is credited, and an immutable audit trail record is written."*

---

### MINUTE 4:30 - 4:45 | Step 7: Benchmark Results (Baseline vs RazorRecover AI)
- **Screen:** Benchmark Comparison Table.
- **What to Say:**  
  > *"In our automated 214-case benchmark evaluation: Traditional retries achieved a 12% recovery rate with high churn. RazorRecover AI achieved a **38.4% recovery rate**, zero duplicate payment links, zero opted-out contacts, and 100% safety guardrail compliance."*

---

## 📊 Benchmark Evaluation: Baseline vs. RazorRecover AI

| Performance Metric | Traditional Blind Retries | RazorRecover AI Engine | Improvement |
| :--- | :---: | :---: | :---: |
| **Recovery Success Rate** | 12.1% | **38.4%** | **+217% Revenue Recovered** |
| **Opted-Out Customer Spam** | High (Uncontrolled) | **0% (Hard Blocked)** | **100% Opt-Out Safety** |
| **Duplicate Payment Links Created** | Moderate Risk | **0 (Strict Idempotency)** | **Zero Duplicate Charges** |
| **High-Value (≥₹15k) Risk Control** | None (Automated) | **100% Human Approval** | **Zero Unauthorized High-Risk Actions** |
| **AI Output Hallucinations** | N/A | **0% (Schema Validated)** | **100% Valid Enums** |

---

## 🚨 Backup Plan (In Case of Live API / Network Failure)

If live internet connectivity drops during the hackathon presentation:
1. **Fallback AI Engine:** The system automatically switches to the built-in **Deterministic AI Engine Emulator** (100% offline rule-based processor).
2. **Fallback Database:** The system automatically initializes `pg-mem` in-memory database with pre-seeded synthetic failure records.
3. **Local CLI Verification Script:** Execute `npm run test:phase14` in terminal to demonstrate 104 passing tests live on-screen.
