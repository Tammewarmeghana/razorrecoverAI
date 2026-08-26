# RazorRecover AI — 3 to 5 Minute Hackathon Judge Demo Script

> **Goal:** Demonstrate the end-to-end autonomous revenue recovery lifecycle, deterministic risk scoring, AI failure diagnosis, guardrail safety, human-in-the-loop oversight, and real Razorpay webhook payment recovery in under 5 minutes.

---

## ⏱️ Step-by-Step Judge Demonstration Flow

### STEP 1: Introduction & Dashboard Overview (0:00 - 0:30)
- **Action:** Open `http://localhost:5173`. Point out top KPI Summary Cards:
  - **Revenue at Risk** (Total value of failed payments)
  - **Recovered Revenue** (Total successfully recovered money)
  - **Recovery Success Rate %**
  - **Active Recovery Cases Breakdown**

### STEP 2: Trigger Live Failure Simulator (0:30 - 1:00)
- **Action:** Click **"⚡ Run Live Failure Simulator"** in the top Judge Demo Bar.
- **Selection:** Choose **"Insufficient Funds (Low Balance)"**, enter Amount: **₹2,499**, Customer: **Hackathon Judge**. Click **Trigger Live Failure**.
- **Explanation:** *"This simulates an instant payment failure recorded from Razorpay."*

### STEP 3: Explain Deterministic Risk Engine (1:00 - 1:30)
- **Action:** Click **"Inspect Case ➔"** on the newly created case. Point to the **Deterministic Risk Engine** section.
- **Explanation:** *"Our Risk Engine calculates a deterministic 0–100 score based on 4 explainable factors: Payment Amount, Failure Type, Customer Payment History, and Retry Recency. This case scored 52/100 (MEDIUM risk)."*

### STEP 4: Demonstrate AI Diagnosis Agent (1:30 - 2:00)
- **Action:** Point to the **🤖 AI Diagnosis Agent** box inside the inspector modal.
- **Explanation:** *"The AI Diagnosis Agent analyzes the technical error logs and customer history to determine the exact root cause (`INSUFFICIENT_FUNDS`), confidence score (85%), and supporting evidence list."*

### STEP 5: Review Recovery Decision Engine (2:00 - 2:20)
- **Action:** Point to the **Recovery Decision Engine** output.
- **Explanation:** *"The Decision Engine combines the risk score, AI recommendation, and merchant retry policies to select the optimal strategy (`PAYMENT_LINK`)."*

### STEP 6: Inspect Guardrail Safety Engine (2:20 - 2:45)
- **Action:** Point to the **🛡️ Guardrail Safety Engine** checklist inside the modal.
- **Explanation:** *"Before executing any recovery action, our Guardrail Engine evaluates 10 sequential safety rules: verifying the case isn't already recovered, the customer hasn't opted out, retry/contact limits aren't exceeded, and the transaction value doesn't require manager approval. Here, all checks passed (`ALLOWED`)."*

### STEP 7: Generate & View Razorpay Payment Link (2:45 - 3:15)
- **Action:** Click **"Execute Recovery Action (Razorpay Payment Link)"**.
- **Result:** Official Razorpay Test Payment Link ID (`plink_...`) and clickable short URL (`https://rzp.io/...`) appear instantly.
- **Explanation:** *"The backend calls Razorpay's official API to issue a 1-click Payment Link. Notice duplicate protection ensures clicking this multiple times will never create duplicate links."*

### STEP 8: Show Human-in-the-Loop Approval Queue (3:15 - 3:50)
- **Action:** Open Live Simulator, select **Amount: ₹25,000** (High Value). Click **Trigger Live Failure**.
- **Result:** Case is flagged with `REQUIRES HUMAN APPROVAL` and routes to the **🛡️ Manager Approvals Queue** tab.
- **Action:** Switch to **Manager Approvals Queue** tab, explain why it was paused ($\ge$ ₹15,000 threshold), and click **"✅ Approve & Issue Link"**.
- **Explanation:** *"For high-value transactions or uncertain AI diagnoses, safety guardrails halt execution and require explicit manager authorization."*

### STEP 9: Show Real Recovered ₹499 Case (3:50 - 4:20)
- **Action:** Filter cases table by **Status: RECOVERED**. Click **Inspect Case ➔** on case `885c2d9a-f922-47d0-9f85-c4697ff6da03`.
- **Explanation:** *"Here is our real recovered case! Upon receiving a verified `payment.captured` webhook over our public tunnel, status updated to `RECOVERED` and amount recovered updated to ₹499.00."*

### STEP 10: Review Security & Audit Trail (4:20 - 5:00)
- **Action:** Click **"📜 Security & Audit Trail"** tab.
- **Explanation:** *"Every single step—from webhook receipt to AI diagnosis, guardrail evaluation, payment link creation, and webhook reconciliation—is logged in an immutable, append-only audit trail. Zero API credentials exist on the frontend, ensuring 100% production security."*
