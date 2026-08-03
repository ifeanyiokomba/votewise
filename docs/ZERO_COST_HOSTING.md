# VoteWise — Zero-Cost Hosting & Deployment Guide

> **How to host VoteWise for perfect productivity without spending money.**
>
> This guide covers free-tier hosting options for every component of the
> VoteWise platform, from development to production.

---

## Architecture Overview

```
                    Internet
                       │
                       ▼
              ┌─────────────────┐
              │   Cloudflare    │  ← Free: CDN + WAF + DNS + SSL
              │   (Free Plan)   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Vercel        │  ← Free: Next.js hosting
              │   (Hobby Plan)  │     (100GB bandwidth, serverless functions)
              └────────┬────────┘
                       │
           ┌───────────┼───────────┐
           ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Supabase │ │ Railway  │ │ Cloudflare│
    │ (Free)   │ │ (Free    │ │ R2 (Free) │
    │          │ │  trial)  │ │           │
    │ Postgres │ │ Redis +  │ │ Object    │
    │ + Auth   │ │ Worker   │ │ Storage   │
    └──────────┘ └──────────┘ └──────────┘
```

---

## 1. Frontend + API: Vercel (Free Hobby Plan)

**Why Vercel?**
- Built by the Next.js team — zero-config deployment
- Free Hobby plan: 100GB bandwidth/month, unlimited deployments
- Automatic HTTPS, global CDN, edge functions
- Perfect for Next.js 16 App Router

**Setup:**
```bash
# 1. Push your code to GitHub (already done)

# 2. Go to vercel.com → Sign up with GitHub

# 3. Import the votewise repository

# 4. Set environment variables (Settings → Environment Variables):
DATABASE_URL=postgresql://... (from Supabase, see below)
REDIS_URL=redis://... (from Railway, see below)
VOTE_ENC_KEY=... (generate with: openssl rand -hex 32)
VOTER_HASH_PEPPER=... (generate with: openssl rand -hex 32)
HMAC_SECRET=... (generate with: openssl rand -hex 32)
SVE_BALLOT_PEPPER=... (generate with: openssl rand -hex 32)
SVE_VOTER_PEPPER=... (generate with: openssl rand -hex 32)
VOTE_KEY_ID=v1
NEXT_PUBLIC_APP_URL=https://votewise.vercel.app
NODE_ENV=production

# 5. Deploy — Vercel automatically builds and deploys on every push to main
```

**Free tier limits:**
- 100GB bandwidth/month (enough for ~50,000 voters)
- Serverless function execution: 100GB-hours/month
- Build time: 6000 minutes/month
- No commercial use (upgrade to Pro $20/month when you go live commercially)

**When to upgrade:**
- When you exceed 100GB bandwidth (large elections)
- When you need custom domains (Pro plan includes them)
- When you go commercial (Hobby plan is for personal/non-commercial)

---

## 2. Database: Supabase (Free Plan)

**Why Supabase?**
- Managed PostgreSQL (no server to maintain)
- Free plan: 500MB database, 50MB file storage
- Built-in auth, real-time subscriptions, REST API
- Perfect for VoteWise's Prisma + PostgreSQL setup

**Setup:**
```bash
# 1. Go to supabase.com → Sign up (free)

# 2. Create a new project:
#    - Name: votewise
#    - Database password: (generate a strong one)
#    - Region: Choose closest to your voters (e.g., Frankfurt for Nigeria)

# 3. Get your connection string:
#    Settings → Database → Connection string → URI
#    Format: postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# 4. Set as DATABASE_URL in Vercel environment variables

# 5. Run Prisma migration:
#    npx prisma migrate deploy
#    (or npx prisma db push for initial setup)
```

**Free tier limits:**
- 500MB database (enough for ~100,000 voters + elections)
- 50MB file storage (logos, candidate photos)
- 2GB bandwidth/month
- Pauses after 1 week of inactivity (just visit the dashboard to resume)

**When to upgrade:**
- When database exceeds 500MB (large elections with many voters)
- When you need point-in-time recovery (Pro plan, $25/month)
- When you need read replicas (for large-scale elections)

**Optimization tips for free tier:**
- Archive old elections to reduce database size
- Compress voter data (store hashes, not full PII)
- Use the read replica for analytics queries
- Clean up old audit logs periodically (retain 90 days, not 365)

---

## 3. Redis + Background Workers: Railway (Free Trial → $5/month)

**Why Railway?**
- One-click Redis + worker deployment
- Docker-based (matches our docker-compose setup)
- Free $5 trial credit (lasts ~1 month of light usage)

**Setup:**
```bash
# 1. Go to railway.app → Sign up with GitHub

# 2. Create a new project → Deploy from GitHub repo

# 3. Add services:
#    a. Redis (Add → Database → Redis)
#    b. Worker (from Dockerfile: mini-services/worker/Dockerfile)
#    c. Scheduler (from Dockerfile: mini-services/scheduler/Dockerfile)

# 4. Set environment variables for each service:
#    DATABASE_URL=postgresql://... (from Supabase)
#    REDIS_URL=redis://... (from Railway Redis service)

# 5. Railway auto-deploys on every push to main
```

**Free tier limits:**
- $5 free credit (lasts ~1 month with light usage)
- After that: $5/month for basic usage

**Alternative: Render.com (Free Redis)**
```bash
# Render offers a free Redis instance (30 days, then $7/month)
# Go to render.com → New → Redis
# Free tier: 25MB, 20 connections
```

**Alternative: Upstash (Free Serverless Redis)**
```bash
# Upstash offers a free Redis-compatible service
# Go to upstash.com → Create database
# Free tier: 10,000 commands/day, 256MB storage
# Perfect for rate limiting + session storage
```

---

## 4. Object Storage: Cloudflare R2 (Free Tier)

**Why Cloudflare R2?**
- S3-compatible object storage
- Free tier: 10GB storage, 1 million reads/month, 10 million writes/month
- No egress fees (unlike AWS S3)
- Perfect for logos, candidate photos, reports, evidence

**Setup:**
```bash
# 1. Go to cloudflare.com → R2 (sign up, free)

# 2. Create a bucket: votewise-storage

# 3. Get API credentials:
#    R2 → Manage R2 API Tokens → Create API Token
#    Permissions: Object Read & Write
#    Set: S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION=auto

# 4. Set as environment variables in Vercel
```

**Free tier limits:**
- 10GB storage (enough for ~10,000 candidate photos + 1,000 reports)
- 1 million Class A operations (writes) per month
- 10 million Class B operations (reads) per month
- Zero egress fees (data transfer is free)

---

## 5. DNS + CDN + SSL: Cloudflare (Free Plan)

**Why Cloudflare?**
- Free DNS hosting with global anycast network
- Free SSL/TLS certificates (automatic)
- Free CDN (caches static assets at 300+ locations worldwide)
- Free WAF rules (basic)
- Free DDoS protection

**Setup:**
```bash
# 1. Go to Cloudflare → Add your domain (votewise.com.ng)

# 2. Change nameservers at your domain registrar to Cloudflare's

# 3. Add DNS records:
#    A    votewise.com.ng        → Vercel IP (76.76.21.21)
#    CNAME www                   → votewise.com.ng
#    CNAME admin                 → votewise.com.ng (platform admin)
#    CNAME *.votewise.com.ng     → votewise.com.ng (org subdomains)
#    CNAME status                → votewise.com.ng
#    CNAME api                   → votewise.com.ng

# 4. SSL/TLS → Set to "Full" (not Flexible)
# 5. Always Use HTTPS → ON
# 6. HSTS → Enable
# 7. Auto Minify → Enable (CSS, JS, HTML)
# 8. Brotli → Enable
```

**Free tier includes:**
- Unlimited DNS queries
- Unlimited bandwidth (CDN)
- Free SSL certificates
- Basic WAF (managed rules)
- DDoS protection (unmetered)

---

## 6. Domain: Free Subdomain or Cheap .com.ng

**Option A: Free Vercel Subdomain (Zero Cost)**
```
https://votewise.vercel.app
https://votewise-xyz.vercel.app
```
- Instant, no DNS setup needed
- Free SSL included
- Limitation: not a custom domain

**Option B: Free .tk/.ml/.ga domain (Not recommended for production)**
```
https://votewise.tk
```
- Free but unreliable, can be taken back
- Not suitable for an election platform

**Option C: .com.ng domain (~₦2,500/year ≈ $3/year)**
```
https://votewise.com.ng
```
- Register at: Whogohost, DomainKing, or TrueHost
- Very affordable for Nigerian businesses
- Professional appearance

**Option D: .vercel.app + custom domain later**
- Start with the free Vercel subdomain
- Add a custom domain when you have funds
- Vercel Pro ($20/month) includes custom domain support

---

## 7. WebSocket (Socket.io): Alternative Approaches

**Problem:** Vercel doesn't support persistent WebSocket connections on the
free plan. Our results-service (port 3030) needs WebSocket.

**Solution A: Polling (Free, works on Vercel)**
```typescript
// Instead of WebSocket, use HTTP polling every 5 seconds
// The client fetches /api/results every 5s instead of holding a WS connection
// This works on Vercel's free plan with no issues
```

**Solution B: Railway-hosted Socket.io (Free trial)**
```bash
# Deploy the results-service on Railway
# Frontend connects to: wss://votewise-results.up.railway.app
# Free during the trial period
```

**Solution C: Ably.com (Free WebSocket hosting)**
```bash
# Ably offers free WebSocket hosting
# Free tier: 3 million messages/month
# Perfect for live results + real-time updates
# Go to ably.com → Sign up → Get API key
```

**Solution D: Pusher.com (Free WebSocket hosting)**
```bash
# Pusher offers free WebSocket channels
# Free tier: 100 max connections, 200K messages/day
# Go to pusher.com → Sign up → Create Channels app
```

---

## 8. Email: Resend (Free Plan)

**Why Resend?**
- Free tier: 3,000 emails/month, 100 emails/day
- Perfect for OTVP delivery via email
- Simple API, Next.js SDK

**Setup:**
```bash
# 1. Go to resend.com → Sign up (free)
# 2. Verify your domain (or use onboarding@resend.dev for testing)
# 3. Get API key: RESEND_API_KEY=re_xxxxx
# 4. Set in Vercel environment variables
```

---

## 9. SMS: Termii (Free Credits)

**Why Termii?**
- Nigerian SMS gateway (perfect for local elections)
- Free trial credits on signup
- Supports SMS + WhatsApp

**Setup:**
```bash
# 1. Go to termii.com → Sign up
# 2. Get API key: TERMII_API_KEY=...
# 3. Set sender ID: TERMII_SENDER_ID=VoteWise
# 4. Set in Vercel environment variables
```

**Cost:** ~₦2-4 per SMS (pay as you go after free credits)

---

## 10. Monitoring: Sentry (Free Developer Plan)

**Why Sentry?**
- Free tier: 5,000 errors/month, 50 performance transactions
- Perfect for error tracking + performance monitoring

**Setup:**
```bash
# 1. Go to sentry.io → Sign up (free)
# 2. Create a Next.js project
# 3. Get DSN: SENTRY_DSN=https://xxx@sentry.io/xxx
# 4. Set in Vercel environment variables
```

---

## 11. GitHub Actions CI/CD: Free for Public Repos

**Already set up:**
- Our `.github/workflows/ci-cd.yml` runs on every push
- Free for public repositories (unlimited minutes)
- Private repos: 2,000 free minutes/month

---

## Complete Zero-Cost Stack Summary

| Component | Service | Free Tier | Limits |
|-----------|---------|-----------|--------|
| Frontend + API | Vercel Hobby | Free | 100GB BW, serverless |
| Database | Supabase Free | Free | 500MB DB, 50MB files |
| Redis | Upstash Free | Free | 10K cmd/day, 256MB |
| Object Storage | Cloudflare R2 | Free | 10GB, 0 egress fees |
| DNS + CDN + SSL | Cloudflare Free | Free | Unlimited |
| WebSocket | Ably Free | Free | 3M messages/month |
| Email | Resend Free | Free | 3K emails/month |
| SMS | Termii | Free credits | Pay-as-you-go after |
| Monitoring | Sentry Dev | Free | 5K errors/month |
| CI/CD | GitHub Actions | Free | Public repos unlimited |
| Domain | Vercel subdomain | Free | OR .com.ng ~$3/year |

**Total monthly cost: $0** (with free subdomain)
**Total monthly cost: ~$3** (with .com.ng domain)

---

## Deployment Checklist (Zero-Cost)

```text
1. ☐ Push code to GitHub (done)

2. ☐ Sign up for Vercel → Import repo → Set env vars → Deploy

3. ☐ Sign up for Supabase → Create project → Get DATABASE_URL → Run prisma db push

4. ☐ Sign up for Upstash → Create Redis → Get REDIS_URL

5. ☐ Sign up for Cloudflare R2 → Create bucket → Get S3 credentials

6. ☐ Sign up for Resend → Get API key → Set RESEND_API_KEY

7. ☐ Sign up for Termii → Get API key → Set TERMII_API_KEY

8. ☐ Sign up for Sentry → Get DSN → Set SENTRY_DSN

9. ☐ Sign up for Cloudflare → Add domain → Set DNS → Enable SSL

10. ☐ Test deployment: visit https://votewise.vercel.app

11. ☐ Run the Election Readiness Checker → All green → Go Live!
```

---

## When You Get Funds: Upgrade Path

| Priority | Upgrade | Cost | Why |
|----------|---------|------|-----|
| 1 | Vercel Pro | $20/mo | Custom domain, 1TB BW, commercial use |
| 2 | Supabase Pro | $25/mo | 8GB DB, PITR, no auto-pause |
| 3 | Termii SMS | ~₦50K/mo | Bulk SMS for voter OTVP |
| 4 | .com.ng domain | ~₦2.5K/yr | Professional domain |
| 5 | Railway (workers) | $5/mo | Always-on Redis + workers |
| 6 | Cloudflare Pro | $20/mo | Advanced WAF, image optimization |

**Total with all upgrades: ~$70/month + SMS costs**

---

## Productivity Tips

1. **Use Vercel Preview Deployments** — every PR gets a preview URL for testing
2. **Use Supabase Dashboard** — visual database management, no CLI needed
3. **Use GitHub Actions** — automated testing on every push (already configured)
4. **Use Cloudflare Analytics** — free traffic insights
5. **Use Sentry Performance** — identify slow API endpoints automatically
6. **Use the Election Readiness Checker** — verify everything is green before go-live

---

## Nigeria-Specific Considerations

1. **Database region**: Choose Supabase's Frankfurt (eu-central-1) — lowest latency from Nigeria
2. **SMS delivery**: Termii is optimized for Nigerian networks (MTN, Glo, Airtel, 9mobile)
3. **Domain**: .com.ng is recognized and trusted by Nigerian users
4. **Payment**: Paystack (Nigerian) is the primary gateway — no international card needed
5. **Data protection**: NDPR compliance is already built in (Chapter 18)
6. **Mobile-first**: Most Nigerian voters will vote on phones — our design is mobile-first
