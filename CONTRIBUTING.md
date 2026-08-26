# Contributing to RazorRecover AI

Thank you for your interest in contributing to **RazorRecover AI**! We welcome contributions to help improve autonomous payment recovery, AI diagnosis accuracy, and financial safety guardrails.

---

## 📜 Development Guidelines & Code Standards

### 1. Security & Financial Integrity Rules
- **Zero Secrets in Code:** Never commit real Razorpay keys, webhook secrets, or database passwords. All configuration must use environment variables loaded via `.env`.
- **Monetary Precision:** All monetary values MUST be processed and stored as `BIGINT` in **paise** (e.g., ₹499.00 = `49900` paise). Never pass raw floating-point numbers for money in database operations.
- **Parameterized SQL:** All PostgreSQL queries must use parameterized SQL placeholders (`$1`, `$2`). Raw string concatenation in SQL queries is strictly forbidden.
- **Server-Side Enforcement:** Clients must never execute direct Razorpay API calls or bypass backend guardrails.

---

## 🧪 Testing Requirements

Every pull request must pass the complete 104-test suite and frontend production build before approval:

```bash
# Run all backend test suites
cd server
npm run test:risk
npm run test:ai
npm run test:decision
npm run test:guardrail
npm run test:execution
npm run test:phase12
npm run test:phase14

# Run frontend build check
cd ../client
npm run build
```

---

## 🛠️ Contribution Workflow

1. Fork the repository on GitHub.
2. Create a feature branch (`git checkout -b feature/amazing-recovery-feature`).
3. Commit your changes with clean git messages (`git commit -m 'Add WhatsApp notification guardrail'`).
4. Ensure all automated tests pass (`npm run test:phase14`).
5. Open a Pull Request on GitHub.

Thank you for helping build safer, smarter revenue recovery tools for Razorpay!
