# VoteWise — Security Hardening

> Spec: "Implement: WAF, DDoS protection, Rate limiting, Intrusion detection,
> Vulnerability scanning, Dependency scanning, Malware scanning."

## 1. Web Application Firewall (WAF) ✅

- **Layer**: Caddy (docker-compose) / AWS WAF (production) / NGINX ingress (k8s)
- **Config**: `Caddyfile` blocks known exploit paths (`/wp-admin*`, `/.env`,
  `/.git/*`, `/xmlrpc.php`, `/phpinfo.php`, `/admin.php`) with HTTP 403.
- **Production**: AWS WAF ruleset attached to the ALB — SQLi protection,
  XSS protection, rate-based rules, geo-blocking for sanctioned countries.

## 2. DDoS Protection ✅

- **Layer**: Cloudflare (CDN layer) + AWS Shield Standard (ALB layer)
- **Cloudflare**: L3/L4/L7 DDoS mitigation, "I'm Under Attack" mode for
  election-day surges.
- **AWS Shield Standard**: automatic, no config needed on ALB.
- **Upgrade path**: AWS Shield Advanced for dedicated DDoS response team
  (DRT) + cost protection during election-day events.

## 3. Rate Limiting ✅

- **Edge**: Caddy `rate_limit` directive (50 req/s per IP, burst 100) —
  see `Caddyfile`.
- **Application**: `src/lib/infra/rate-limit.ts` — per-endpoint limits:
  - Vote casting: 10/min
  - OTP request: 5/5min (prevents OTP flooding)
  - Login: 10/min (brute-force protection)
  - Password reset: 3/hour
  - API (general): 60/min
  - Receipt verify: 30/min
  - Read: 200/min
  - Write: 30/min
- **Redis-backed** in production (distributed across replicas); in-memory
  fallback in sandbox.

## 4. Intrusion Detection ✅

- **AWS GuardDuty**: provisioned in `infrastructure/main.tf` —
  `aws_guardduty_detector` with S3 logs + Kubernetes audit logs (production).
  Detects: unusual API calls, unauthorized deployments, compromised
  instances, reconnaissance, persistence, credential exfiltration.
- **Findings**: published every 15 minutes to CloudWatch + SNS → routed
  to the alerting pipeline (email/SMS/Slack/Teams).
- **Kubernetes**: GuardDuty Kubernetes protection monitors EKS audit logs
  for pod compromises, privilege escalations, and anomalous API server
  access.

## 5. Vulnerability Scanning ✅

- **CodeQL**: GitHub code scanning on every PR (semantic analysis for
  SQL injection, XSS, path traversal, etc.).
- **Trivy**: filesystem scan in CI (`.github/workflows/ci-cd.yml`) —
  scans for known CVEs in OS packages + language dependencies.
- **Container scanning**: Trivy scans the built Docker image before push.
- **Runtime**: AWS Inspector (EC2/ECS) for running workload
  vulnerability assessment.

## 6. Dependency Scanning ✅

- **npm audit**: runs in CI on every push (`npm audit --audit-level=high`).
  Blocks the pipeline on high+ severity vulnerabilities.
- **Dependabot**: enabled on the GitHub repo — opens PRs automatically
  when dependencies have known vulnerabilities.
- **Snyk** (optional upgrade): continuous dependency monitoring with
  auto-remediation PRs.

## 7. Malware Scanning ✅

- **ClamAV sidecar**: a ClamAV container runs alongside the app in the
  k8s/docker-compose stack. All user-uploaded files (logos, attachments,
  evidence) are scanned via `storage.upload()` before being persisted to S3.
  Infected files are quarantined and a security alert is raised.
- **EICAR test**: the ClamAV container is tested weekly with an EICAR
  test file to verify scanning is functional.
- **S3 object scanning**: Amazon Macie scans S3 for sensitive data (PII,
  credentials) accidentally uploaded to object storage.

## Defense-in-Depth Summary

```
Cloudflare (L3/L4/L7 DDoS + WAF)
    ↓
AWS Shield Standard (ALB DDoS)
    ↓
AWS WAF (SQLi/XSS/rate/geo rules)
    ↓
Caddy/NGINX (path blocking + rate limit + TLS 1.3)
    ↓
Next.js middleware (security headers + org routing)
    ↓
Application rate limiting (per-endpoint, Redis-backed)
    ↓
GuardDuty (IDS — runtime threat detection)
    ↓
ClamAV (malware scanning on uploads)
    ↓
Trivy + npm audit + CodeQL (CI/CD vulnerability gates)
```

Every layer is independently configurable and scales independently.
