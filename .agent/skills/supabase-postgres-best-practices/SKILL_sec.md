---
name: security-scan
description: Run a security audit. Use before production deployment, after major features, or when security review is needed.
context: fork
agent: security-reviewer
allowed-tools:
  - Read
  - Grep
  - Glob
  - Task
  - Bash
---

# /security-scan — Security Audit

Comprehensive security audit combining agent-based code review with automated scans.

## Process

### 1. Launch security-reviewer agent

Launch the **security-reviewer** agent to perform a full 8-category scored security audit of the codebase.

### 2. Automated scans

Run these scans in parallel with the agent review:

**npm audit:**
```bash
npm audit --json 2>/dev/null || true
```
Review results for high/critical vulnerabilities. Flag any with known exploits.

**Environment variable scan:**
Check for proper env var handling:
- Scan for hardcoded secrets in source files (API keys, passwords, tokens)
- Verify `.env` is in `.gitignore`
- Check `NEXT_PUBLIC_` prefix usage (only truly public values)
- Verify server-only secrets are not imported in client code

**Secrets-in-source scan:**
Search for patterns that indicate leaked secrets:
- `sk_live_`, `sk_test_` (Stripe secret keys)
- `service_role` key values
- `password`, `secret`, `token` in string literals
- Base64-encoded credentials
- Private keys or certificates

### 3. Unified report

Combine the security-reviewer agent's scored report with automated scan findings:

```markdown
## Security Scan Report

**Date:** YYYY-MM-DD
**Overall Risk Level:** CRITICAL / HIGH / MEDIUM / LOW

### Agent Security Audit
[Include the full security-reviewer agent report]

### Automated Scan Results

#### npm audit
| Severity | Count | Details |
|----------|-------|---------|
| Critical | X | ... |
| High | X | ... |
| Moderate | X | ... |

#### Secrets Scan
- [ ] No hardcoded secrets found
- [ ] .env in .gitignore
- [ ] NEXT_PUBLIC_ used correctly
- [ ] Server secrets not in client code

### Action Items
1. **[CRITICAL]** ...
2. **[HIGH]** ...
3. **[MEDIUM]** ...

### Summary
- Security audit score: X/80
- npm vulnerabilities: X critical, Y high
- Secrets found: X
- Total action items: X
```

## Rules

- Do NOT modify any files — audit only
- Run `npm audit` but do NOT auto-fix (let the user decide)
- Flag any finding with a concrete fix recommendation
- Prioritize by real-world exploitability
- If no issues found in a category, explicitly mark it as clear
