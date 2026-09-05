# Personal Private Email System - Master Project Plan

## Executive Summary

We are building a personal private email system that gives individuals full ownership and control over their email data. The MVP is a working personal email server for the founder's own use. The full product vision is a packaged, easy-to-deploy solution that non-technical consumers can set up to run their own private email.

The core architectural insight is the **hybrid model**: self-host inbound mail for full data sovereignty, use established relay services for outbound mail to solve the deliverability problem that has historically killed self-hosted email projects. This approach gives users the privacy benefits of self-hosting without the deliverability nightmare.

The product fills the gap between "I want email privacy" and "I don't want to be a sysadmin" - a space where previous attempts (Helm, Sovereign) have failed but where demand is growing alongside rising privacy awareness.

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Technical Architecture](#2-technical-architecture)
3. [Product Design & UX](#3-product-design--ux)
4. [Infrastructure & DevOps](#4-infrastructure--devops)
5. [Go-to-Market Strategy](#5-go-to-market-strategy)
6. [Phased Roadmap](#6-phased-roadmap)
7. [Risk Register](#7-risk-register)
8. [Open Questions](#8-open-questions)

---

## 1. Vision & Goals

### Mission Statement
Democratize email privacy by making self-hosted email as easy as installing an app, without sacrificing reliability or deliverability.

### MVP Goal (Phase 1)
A working personal email system for the founder that:
- Sends and receives email reliably for 30+ days
- Handles spam filtering adequately
- Has a web-based admin dashboard
- Includes webmail access
- Runs on a single VPS via Docker Compose
- Costs under $15/month to operate

### Product Goal (Phase 3-4)
A packaged solution where any non-technical person can:
- Deploy their own private email server in under 30 minutes
- Use a guided setup wizard that handles DNS, TLS, and relay configuration
- Monitor their system health through an intuitive dashboard
- Receive automatic updates and security patches
- Migrate their existing email from Gmail/Outlook

### Non-Goals
- We are NOT building a Gmail competitor with full office suite integration
- We are NOT building a multi-tenant email hosting platform (this is personal/family email)
- We are NOT building end-to-end encryption (that's PGP/S/MIME territory - can be added later)
- We are NOT building our own mail server from scratch (we leverage existing open-source servers)

---

## 2. Technical Architecture

### Technology Stack

| Component | Choice | Justification |
|-----------|--------|---------------|
| **Mail Server** | **Stalwart Mail Server** | Modern (Rust), single binary, JMAP + IMAP + SMTP, excellent Docker support, actively maintained, lightweight (runs on 1GB RAM), built-in spam filtering via sieve scripts |
| **Admin UI** | **SvelteKit** | Fast, lightweight, excellent DX, produces small bundles ideal for a self-hosted app, TypeScript native |
| **Reverse Proxy** | **Caddy** | Automatic HTTPS with Let's Encrypt, simple config, HTTP/3 support, perfect for self-hosted setups |
| **Database** | **SQLite** (MVP) / **PostgreSQL** (full product) | SQLite is zero-config for single-user MVP; PostgreSQL for production multi-domain |
| **Webmail** | **Roundcube** (MVP) / **Custom** (later) | Roundcube is battle-tested, has plugin ecosystem; custom webmail can come in Phase 3 |
| **Spam Filtering** | **Rspamd** | Superior to SpamAssassin in performance and accuracy, ML capabilities, web UI for tuning, integrates well with Stalwart |
| **Outbound Relay** | **Amazon SES** (primary recommendation) | Cheapest at scale ($0.10/1000), generous free tier from EC2, excellent deliverability, simple SMTP relay setup |
| **Backup** | **Restic** | Encrypted, deduplicated, supports multiple backends (S3, B2, local), excellent for automated backups |
| **Monitoring** | **Custom health checks + UptimeRobot** | Lightweight for MVP; custom dashboard integration for full product |

### Architecture Diagram

```
                    INTERNET
                       │
          ┌────────────┼────────────┐
          │            │            │
     Inbound Mail    HTTPS      Outbound Mail
     (Port 25)    (Port 443)    (via Relay)
          │            │            │
          ▼            ▼            ▼
    ┌─────────────────────────────────────┐
    │           Caddy (Reverse Proxy)      │
    │     TLS termination, routing         │
    └──────┬──────────┬──────────┬────────┘
           │          │          │
           ▼          ▼          ▼
    ┌──────────┐ ┌─────────┐ ┌──────────┐
    │ Stalwart │ │ Admin   │ │Roundcube │
    │  Mail    │ │ UI      │ │ Webmail  │
    │ Server   │ │(Svelte) │ │          │
    │          │ │         │ │          │
    │ SMTP/IMAP│ │ REST API│ │ IMAP     │
    │ JMAP     │ │         │ │ Client   │
    └────┬─────┘ └────┬────┘ └────┬─────┘
         │            │           │
         ▼            ▼           ▼
    ┌─────────────────────────────────────┐
    │     Shared Docker Network            │
    │                                      │
    │  ┌──────────┐  ┌──────────────────┐ │
    │  │  Rspamd  │  │  SQLite/Postgres │ │
    │  │  (Spam)  │  │  (Config/Meta)   │ │
    │  └──────────┘  └──────────────────┘ │
    └─────────────────────────────────────┘
         │
         ▼
    ┌──────────┐     ┌──────────────┐
    │  Restic  │────▶│ S3/B2 Backup │
    │ (Backup) │     │   Storage    │
    └──────────┘     └──────────────┘
```

### Docker Compose Structure

```
project/
├── docker-compose.yml          # Main orchestration
├── docker-compose.override.yml # Local dev overrides
├── .env                        # Environment variables (secrets)
├── caddy/
│   └── Caddyfile              # Reverse proxy config
├── stalwart/
│   └── config/                # Mail server configuration
├── rspamd/
│   └── local.d/               # Spam filter rules
├── admin-ui/
│   ├── src/                   # SvelteKit app
│   └── Dockerfile
├── roundcube/
│   └── config/                # Webmail config
├── backups/
│   └── restic.conf            # Backup configuration
└── scripts/
    ├── setup.sh               # Initial setup script
    ├── health-check.sh        # Health monitoring
    └── dns-validate.sh        # DNS record checker
```

### Key Docker Containers

| Container | Image | Ports | Purpose |
|-----------|-------|-------|---------|
| `caddy` | caddy:2-alpine | 80, 443 | Reverse proxy, TLS |
| `stalwart` | stalwartlabs/mail-server | 25, 465, 587, 993 | Mail server |
| `rspamd` | rspamd/rspamd | (internal) | Spam filtering |
| `admin-ui` | custom build | (internal) | Management dashboard |
| `roundcube` | roundcube/roundcubemail | (internal) | Webmail |
| `redis` | redis:alpine | (internal) | Rspamd backend |

### API Design (Admin UI Backend)

```
REST API Endpoints:

GET    /api/health              # System health overview
GET    /api/health/dns          # DNS record validation
GET    /api/health/deliverability # Deliverability status

GET    /api/domains             # List configured domains
POST   /api/domains             # Add new domain
DELETE /api/domains/:id         # Remove domain

GET    /api/accounts            # List email accounts
POST   /api/accounts            # Create email account
PUT    /api/accounts/:id        # Update account
DELETE /api/accounts/:id        # Delete account

GET    /api/stats               # Mail statistics (sent/received/spam)
GET    /api/stats/deliverability # Deliverability rates by provider

GET    /api/spam/rules          # Spam filter rules
PUT    /api/spam/rules          # Update spam rules
GET    /api/spam/quarantine     # Quarantined messages

GET    /api/logs                # Recent mail logs
GET    /api/logs/errors         # Error logs

POST   /api/backup/trigger      # Trigger manual backup
GET    /api/backup/status       # Backup status and history

POST   /api/setup/dns           # Generate DNS records
POST   /api/setup/relay         # Configure outbound relay
POST   /api/setup/test          # Send test email
```

### Development Order (MVP)

1. **Week 1-2**: Docker Compose with Stalwart + Caddy, basic SMTP/IMAP working
2. **Week 2-3**: DNS setup, TLS automation, outbound relay configuration
3. **Week 3-4**: Rspamd integration, spam filtering tuned
4. **Week 4-5**: Admin UI scaffolding - health dashboard, domain/account management
5. **Week 5-6**: Roundcube integration, webmail working
6. **Week 6-7**: Backup system, monitoring, health checks
7. **Week 7-8**: Migration tool (Gmail IMAP import), polish, testing
8. **Week 8+**: Dog-food on personal email, iterate

---

## 3. Product Design & UX

### User Personas

**Persona 1: "Privacy-First Developer" (MVP Target)**
- Technically skilled, comfortable with Docker/CLI
- Motivated by data ownership and principle
- Willing to invest time for control over their data
- Already self-hosts other services (Nextcloud, Plex, etc.)
- Pain point: Knows email is the last thing they haven't self-hosted

**Persona 2: "Concerned Professional" (Phase 2-3 Target)**
- Semi-technical, can follow guides but not debug
- Journalist, lawyer, or activist with real privacy needs
- Willing to pay for privacy but wants it to "just work"
- Pain point: ProtonMail is in Switzerland but still a third party

**Persona 3: "Privacy-Aware Parent" (Phase 3-4 Target)**
- Non-technical, uses technology as a consumer
- Wants family email that isn't mined by Google
- Needs the simplest possible setup and zero maintenance
- Pain point: Doesn't want kids' email data training AI models

**Persona 4: "Small Business Owner" (Phase 4 Target)**
- Needs professional email on custom domain
- Doesn't want to pay $6/user/month to Google Workspace
- Needs basic compliance and backup
- Pain point: Cost and data control for small team

### Setup Wizard Flow (Full Product)

```
Step 1: Welcome
  "Set up your private email in 4 steps"
  [Get Started]

Step 2: Domain Setup
  "Enter your domain name"
  → Validates domain ownership
  → Shows DNS records to add (with copy buttons)
  → Real-time DNS propagation checker
  → "Waiting for DNS... ✓ MX Record ✓ SPF ✓ DKIM ✓ DMARC"

Step 3: Outbound Relay
  "Choose how to send email"
  → Option A: Amazon SES (recommended, cheapest)
  → Option B: SendGrid (easiest setup)
  → Option C: Mailgun
  → Option D: Direct sending (advanced, not recommended)
  → Guided API key entry
  → Send test email to verify

Step 4: Create Your Account
  → First email address: you@yourdomain.com
  → Set password
  → Optional: import from Gmail/Outlook

Step 5: Done!
  → Dashboard with health status
  → Links to webmail, mobile app setup (IMAP settings)
  → "Send yourself a test email"
```

### Admin Dashboard Screens

**1. Home / Health Dashboard**
- System status: green/yellow/red indicators
- Uptime percentage (last 30 days)
- Storage used vs available
- Recent activity: messages sent/received today
- Alerts: any issues needing attention
- Quick actions: send test email, check DNS, trigger backup

**2. Domain Management**
- List of configured domains
- DNS record status per domain (checkmarks for MX, SPF, DKIM, DMARC)
- Add/remove domains
- DNS record generator with copy-to-clipboard

**3. Account Management**
- List of email accounts with storage usage
- Create/edit/delete accounts
- Password reset
- Alias management
- Forwarding rules

**4. Mail Statistics**
- Sent/received/blocked counts over time (charts)
- Deliverability rates by destination provider
- Top senders/recipients
- Spam statistics

**5. Spam & Filtering**
- Spam filter sensitivity slider
- Quarantine viewer (review caught spam)
- Whitelist/blacklist management
- Custom filter rules

**6. Backup & Storage**
- Last backup time and size
- Backup history with restore option
- Storage breakdown by account
- Manual backup trigger

**7. Settings**
- Relay configuration
- TLS certificate status and renewal
- System updates available
- Log viewer

### Mobile Considerations
- Admin dashboard: responsive web design (not a native app)
- Webmail: Roundcube is responsive; for Phase 3, consider a PWA
- Setup wizard: must work on mobile since some users will configure from phone
- Standard IMAP/SMTP works with any mobile mail client (Apple Mail, Outlook, Gmail app, K-9 Mail)

### Error Handling UX Philosophy
- **Never show raw error messages** - translate to human-readable language
- **Always suggest a fix** - "Your DNS records are misconfigured. Here's what to change: [copy]"
- **Traffic light system** - Green (all good), Yellow (degraded but working), Red (action needed)
- **Proactive alerts** - Don't wait for the user to discover problems

---

## 4. Infrastructure & DevOps

### Recommended VPS Providers

| Provider | Plan | Specs | Price/mo | Port 25 | PTR Record | Notes |
|----------|------|-------|----------|---------|------------|-------|
| **Hetzner** (recommended) | CX22 | 2 vCPU, 4GB RAM, 40GB SSD | ~$4.50 | Yes | Yes | Best value, European, good IP reputation |
| DigitalOcean | Basic Droplet | 2 vCPU, 2GB RAM, 50GB SSD | $12 | Yes (request) | Yes | Good docs, marketplace option |
| Vultr | Cloud Compute | 2 vCPU, 2GB RAM, 55GB SSD | $12 | Yes (request) | Yes | Many locations, clean IPs |
| Linode/Akamai | Shared | 2 vCPU, 2GB RAM, 50GB SSD | $12 | Yes | Yes | Established reputation |
| OVH | VPS Starter | 2 vCPU, 2GB RAM, 40GB SSD | ~$7 | Yes | Yes | Cheap, but support is slow |

**Note**: AWS, Azure, and GCP are NOT recommended for personal email - port 25 restrictions and complex pricing.

### Minimum Server Requirements
- **CPU**: 1-2 vCPU (2 recommended)
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum + 2-5GB per email account per year
- **Bandwidth**: 1TB/month (more than sufficient)
- **OS**: Ubuntu 22.04 LTS or Debian 12

### DNS Configuration Template

```
; MX Record - tells the world where to deliver your mail
yourdomain.com.    IN  MX  10  mail.yourdomain.com.

; A Record - points to your server
mail.yourdomain.com.  IN  A  YOUR_SERVER_IP

; SPF - declares authorized senders
yourdomain.com.    IN  TXT  "v=spf1 a mx include:amazonses.com -all"

; DKIM - cryptographic signature (generated by Stalwart)
default._domainkey.yourdomain.com.  IN  TXT  "v=DKIM1; k=rsa; p=YOUR_DKIM_PUBLIC_KEY"

; DMARC - policy for failed authentication
_dmarc.yourdomain.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"

; PTR Record (Reverse DNS) - set via VPS provider panel
YOUR_SERVER_IP  IN  PTR  mail.yourdomain.com.

; Autodiscover/Autoconfig for mail clients
_autodiscover._tcp.yourdomain.com.  IN  SRV  0 0 443 mail.yourdomain.com.
autoconfig.yourdomain.com.  IN  CNAME  mail.yourdomain.com.
```

### Outbound Relay Setup (Amazon SES)

**Why SES**:
- $0.10 per 1,000 emails (cheapest)
- 3,000/month free from EC2 instances
- Excellent deliverability reputation
- Simple SMTP credentials
- SES sandbox mode for testing

**Setup steps** (automated in setup wizard):
1. Create AWS account and verify domain in SES
2. Request production access (exits sandbox)
3. Generate SMTP credentials
4. Configure Stalwart to relay outbound via SES SMTP endpoint
5. Update SPF record to include SES

### Security Hardening Checklist

```
[x] Firewall (ufw/iptables):
    - Allow: 22 (SSH), 25 (SMTP), 80 (HTTP), 443 (HTTPS),
             465 (SMTPS), 587 (Submission), 993 (IMAPS)
    - Deny: everything else

[x] fail2ban:
    - SSH brute force protection
    - SMTP auth brute force protection
    - Admin panel brute force protection

[x] SSH hardening:
    - Key-only auth (disable password)
    - Disable root login
    - Change default port (optional)

[x] Docker security:
    - Non-root container users
    - Read-only filesystems where possible
    - Resource limits (memory, CPU)
    - No privileged containers

[x] TLS:
    - TLS 1.2+ only
    - Strong cipher suites
    - Auto-renewal via Caddy/Let's Encrypt
    - HSTS headers on admin/webmail

[x] Updates:
    - Unattended security updates for OS
    - Container image update monitoring
```

### Backup Strategy

| What | Frequency | Retention | Destination | Tool |
|------|-----------|-----------|-------------|------|
| Mailboxes | Daily | 30 days | Backblaze B2 ($0.005/GB) | Restic |
| Config files | Daily | 30 days | Same | Restic |
| Database | Daily | 30 days | Same | pg_dump + Restic |
| Full system | Weekly | 4 weeks | VPS snapshots | Provider API |

**Cost**: ~$0.50-2/month for B2 storage for personal use

### Monthly Cost Breakdown (MVP Personal Use)

| Item | Cost |
|------|------|
| VPS (Hetzner CX22) | $4.50 |
| Domain name | ~$1/month (amortized) |
| Outbound relay (SES free tier) | $0.00 |
| Backup storage (B2, ~10GB) | $0.05 |
| **Total** | **~$5.55/month** |

### Monitoring Stack

**MVP (Personal Use):**
- Built-in health check endpoint (`/api/health`)
- UptimeRobot (free tier) for external uptime monitoring
- Cron job for daily blacklist checking (via API)
- Email alerts for critical issues
- Log rotation with logrotate

**Full Product:**
- Custom monitoring dashboard in admin UI
- Deliverability tracking per destination provider
- Blacklist monitoring (MXToolbox API, multirbl.valli.org)
- Storage usage alerts
- Certificate expiry alerts
- Optional opt-in anonymized telemetry

### Auto-Update Pipeline (Full Product)

```
GitHub Releases
    │
    ▼
Watchtower (monitors Docker Hub for new images)
    │
    ▼
Pre-update health check
    │
    ▼
Pull new images
    │
    ▼
Rolling restart (zero-downtime for SMTP)
    │
    ▼
Post-update health check
    │
    ├── ✓ Success → Log update, notify user
    │
    └── ✗ Failure → Automatic rollback to previous images
```

### CI/CD Pipeline (Product Development)

```
GitHub Push
    │
    ├── Lint & Type Check
    ├── Unit Tests
    ├── Integration Tests (Docker Compose up, send/receive test email)
    │
    ▼
Build Docker Images
    │
    ▼
Push to GitHub Container Registry (ghcr.io)
    │
    ▼
Tag Release
    │
    ▼
Users auto-update via Watchtower
```

---

## 5. Go-to-Market Strategy

### Market Analysis

**Total Addressable Market:**
- ProtonMail has 100M+ accounts (2024), growing ~30% annually
- r/selfhosted has 500K+ members
- Global email users: 4.5 billion
- Privacy-concerned email users (willing to pay): estimated 50-100M
- Self-hosting enthusiasts willing to run their own: estimated 2-5M
- **Serviceable market for this product**: 500K-2M users

**Competitive Positioning:**

```
                    Easy Setup
                       ▲
                       │
     ProtonMail ●      │      ● Our Product (Goal)
                       │
     Tutanota ●        │
                       │
  ───────────────────────────────────► Full Data Control
                       │
     Fastmail ●        │      ● Cloudron
                       │
                       │      ● Mailcow
     Gmail ●           │      ● Mail-in-a-Box
                       │
                    Hard Setup
```

### Product Name Ideas

| Name | Rationale | Domain Availability |
|------|-----------|-------------------|
| **OwnMail** | Clear, descriptive, "own your email" | Check availability |
| **Sovereign Mail** | Privacy/control connotation | Check availability |
| **HarbourMail** | Safe harbor for your data | Check availability |
| **PostBox** | Classic, tangible, self-contained | Check availability |
| **InboxOwner** | Direct benefit statement | Check availability |
| **MailVault** | Security + storage connotation | Check availability |
| **FreePost** | Freedom + email | Check availability |
| **SelfMail** | Self-hosted + mail | Check availability |

### Tagline Options

1. "Your email. Your server. Your rules."
2. "Email that belongs to you."
3. "Private email, without the PhD."
4. "Take your inbox back."
5. "Self-hosted email that just works."

### Core Messaging Pillars

1. **Privacy**: Your emails are stored on YOUR server. No one else can read them.
2. **Ownership**: You own your data. No terms of service changes can take it away.
3. **Simplicity**: Self-hosted email without the complexity. Setup in under 30 minutes.
4. **Reliability**: Hybrid architecture means your emails actually get delivered.
5. **Cost**: Less than a coffee per month for complete email independence.

### Elevator Pitch (Non-Technical)
"You know how Gmail reads your email to show you ads? And how all your messages sit on Google's servers? We built a way for you to run your own email server - like having your own private post office. It takes 30 minutes to set up, costs about $5 a month, and your emails never touch anyone else's computers."

### Addressing Objections

| Objection | Response |
|-----------|----------|
| "It's too hard" | "Our setup wizard handles everything. If you can register a domain name, you can set this up." |
| "What if I lose my email?" | "Automatic daily backups to the cloud. You can restore with one click. We back up more than Gmail does for free users." |
| "Why not just use ProtonMail?" | "ProtonMail is great, but your data is still on their servers, in their jurisdiction, subject to their policies. With this, you have complete control." |
| "What about spam?" | "We use the same enterprise-grade spam filtering (Rspamd) used by major providers. It blocks 99%+ of spam." |
| "Will my emails get delivered?" | "We use the same sending infrastructure (Amazon SES) that companies like Netflix and Airbnb use. Your deliverability is the same as theirs." |

### Go-to-Market Phases

**Pre-Launch (During Phase 2-3 Development):**
- Blog series: "Building My Own Email Server" - document the journey
- Reddit posts in r/selfhosted, r/privacy, r/homelab
- Hacker News "Show HN" for early alpha
- GitHub repo with early-access stars
- Email list for interested users (ironic, but effective)

**Launch (Phase 4):**
- Product Hunt launch (aim for top 5 of the day)
- Hacker News "Show HN" for v1.0
- Blog post: "Why I Left Gmail and Built This Instead"
- Reddit across privacy and self-hosting communities
- Submit to DigitalOcean/Vultr marketplace

**Post-Launch Growth:**
- Content marketing: SEO-optimized guides ("how to self-host email 2026")
- YouTube video tutorials and demos
- Partnership with VPS providers (affiliate or co-marketing)
- Partnership with domain registrars
- Privacy advocacy organization partnerships (EFF, ACLU tech)
- Referral program: "Give a friend private email"
- Conference talks at self-hosting and privacy events

### Pricing Strategy (Recommendation: Open Core)

| Tier | Price | Features |
|------|-------|----------|
| **Community** (open source) | Free | Full email server, admin UI, setup wizard, Docker deployment |
| **Pro** | $5/month or $50/year | Managed relay service (no AWS account needed), auto-updates, priority support, monitoring dashboard |
| **Family** | $10/month or $100/year | Pro + multi-domain, up to 10 accounts, family management features |

The free tier must be fully functional (no crippled features) to build community trust. Revenue comes from convenience, not gatekeeping.

---

## 6. Phased Roadmap

### Phase 0: Research & Architecture (COMPLETE)
- Email protocol research
- Provider analysis
- Self-hosting challenges identified
- Technical architecture designed
- Product plan created

### Phase 1: MVP Build (Personal Use)
**Duration**: 8-10 weeks
**Goal**: Working personal email on founder's own domain

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1-2 | Core mail server | Stalwart + Caddy in Docker, send/receive working |
| 2-3 | DNS & TLS | Full DNS setup, Let's Encrypt automated, PTR configured |
| 3-4 | Outbound relay | SES configured, SPF/DKIM/DMARC passing |
| 4-5 | Spam filtering | Rspamd integrated, basic rules tuned |
| 5-6 | Admin UI v1 | Health dashboard, account management, DNS checker |
| 6-7 | Webmail | Roundcube integrated, accessible via HTTPS |
| 7-8 | Backup & monitoring | Restic backups, health checks, basic alerting |
| 8-10 | Dog-fooding | Use as primary email, fix issues, iterate |

**Definition of Done**:
- Can send email to Gmail/Outlook and have it land in inbox (not spam)
- Can receive email from any sender
- Spam filtering catches >95% of spam
- Webmail works on desktop and mobile
- Backups run daily and restore has been tested
- System has been running reliably for 30 consecutive days

### Phase 2: Packaging
**Duration**: 4-6 weeks
**Goal**: Someone else can deploy from README in under 1 hour

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1-2 | Setup automation | Setup script, .env generator, DNS validation |
| 2-3 | Documentation | README, quickstart guide, troubleshooting |
| 3-4 | Initial setup wizard | Web-based setup wizard (basic) |
| 4-5 | Testing | Deploy on 3 different VPS providers, test with 3 beta users |
| 5-6 | GitHub release | v0.1 public release, Docker images on GHCR |

**Definition of Done**:
- 3 beta testers successfully deploy from documentation alone
- Average setup time under 60 minutes for technical users
- GitHub repo with clear README, LICENSE, and contribution guidelines

### Phase 3: Consumer Polish
**Duration**: 6-8 weeks
**Goal**: Non-technical user can deploy with setup wizard

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1-2 | Enhanced setup wizard | Full guided wizard with real-time validation |
| 2-3 | IMAP migration tool | Import from Gmail/Outlook/other IMAP servers |
| 3-4 | Auto-updates | Watchtower integration, rollback capability |
| 4-5 | Monitoring dashboard | Deliverability tracking, blacklist monitoring |
| 5-6 | AI assistance | AI-powered setup help, troubleshooting, monitoring |
| 6-8 | User testing | Test with 10 non-technical users, iterate on UX |

**Definition of Done**:
- Non-technical users can deploy in under 30 minutes with wizard
- Auto-updates work with automatic rollback on failure
- Migration tool successfully imports from Gmail with labels/folders

### Phase 4: Go-to-Market
**Duration**: 4-6 weeks
**Goal**: Public launch with community traction

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1-2 | Pre-launch content | Blog posts, demo video, landing page |
| 2-3 | Marketplace submissions | DigitalOcean, Vultr marketplace images |
| 3-4 | Launch | Product Hunt, Hacker News, Reddit |
| 4-6 | Community building | Discord/Matrix, documentation site, contributor guidelines |

**Success Metrics**:
- 500+ GitHub stars in first month
- 100+ active deployments in first 3 months
- 50+ community members in Discord/Matrix
- <24hr average response time on issues

---

## 7. Risk Register

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gmail/Outlook blocks our relay IPs | Low | Critical | Using established relay (SES) with existing reputation; this is the whole point of the hybrid architecture |
| Stalwart has a critical vulnerability | Medium | High | Monitor releases, auto-update system, security alerts, have rollback plan |
| Data loss from backup failure | Low | Critical | Test restores monthly, dual backup destinations, backup integrity verification |
| Server compromise / email used for spam | Low | Critical | fail2ban, container isolation, minimal attack surface, automatic security updates |
| DNS misconfiguration by user | High | Medium | Automated DNS validation in setup wizard, clear error messages, health checks |
| ISP blocks port 25 (residential users) | High | High | VPS-only deployment (don't support home hosting for inbound); clearly communicate this |

### Market Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Market too small to sustain | Medium | High | Open-source model doesn't require revenue; optional Pro tier for sustainability |
| Helm-style failure (company disappears, users stranded) | Medium | Critical | Open-source + standard Docker = users always have full control; no vendor lock-in |
| ProtonMail adds self-hosting option | Low | High | Our advantage is full data control on user's infrastructure, not just encryption |
| Regulatory changes to email hosting | Low | Medium | Stay compliant, document requirements, make compliance features available |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Support burden from non-technical users | High | Medium | Excellent documentation, community support, AI-assisted troubleshooting |
| Founder burnout (solo project) | Medium | High | Build community early, accept contributions, don't over-promise |
| Users misconfigure and lose email | Medium | High | Guardrails in setup wizard, mandatory backups, health monitoring |

---

## 8. Open Questions & Decision Points

### Must Decide Before Phase 1

1. **Final mail server choice**: Stalwart vs Maddy? (Recommendation: Stalwart for JMAP support and active development)
2. **Admin UI framework**: SvelteKit vs Next.js? (Recommendation: SvelteKit for lighter weight)
3. **Which relay service to set up first**: SES vs SendGrid? (Recommendation: SES for cost, but support both)
4. **Domain for the project**: Purchase domain, set up landing page
5. **License**: MIT vs AGPL vs Apache 2.0? (Recommendation: AGPL to prevent closed-source forks taking without contributing)

### Must Decide Before Phase 2

6. **Product name**: Final name selection from candidates
7. **GitHub organization**: Personal repo vs organization?
8. **Container registry**: GHCR vs Docker Hub?
9. **Beta tester recruitment**: How many, where to find them?

### Must Decide Before Phase 3

10. **AI integration depth**: Simple rule-based helpers vs full LLM integration?
11. **Mobile approach**: PWA vs native app vs just standard IMAP clients?
12. **Calendar/contacts**: Include CalDAV/CardDAV in scope or not?
13. **Multi-domain**: How many domains should one instance support?

### Must Decide Before Phase 4

14. **Pricing model**: Open core vs donation-based vs subscription?
15. **Community platform**: Discord vs Matrix vs both?
16. **Managed relay service**: Build our own relay offering or partner?
17. **Company structure**: Open-source project vs company vs nonprofit?

### Ongoing Questions

18. How do we handle the deliverability problem long-term if Gmail/Microsoft tighten policies further?
19. Should we build a federation/cooperative model where users pool reputation?
20. What's our stance on lawful intercept/government requests?
21. Should we support running on Raspberry Pi / home servers (inbound via tunnel service like Cloudflare Tunnel)?

---

## Glossary

| Term | Definition |
|------|-----------|
| **SMTP** | Protocol for sending email between servers |
| **IMAP** | Protocol for reading email, keeps messages on server |
| **JMAP** | Modern JSON-based replacement for IMAP |
| **MX Record** | DNS record pointing to a domain's mail server |
| **SPF** | DNS record listing authorized sending IPs for a domain |
| **DKIM** | Cryptographic signature proving email wasn't tampered with |
| **DMARC** | Policy telling receivers how to handle unauthenticated email |
| **PTR Record** | Reverse DNS - maps IP address back to hostname |
| **Relay Service** | Third-party service that sends email on your behalf (e.g., SES) |
| **Rspamd** | Open-source spam filtering system |
| **Caddy** | Web server with automatic HTTPS |
| **Stalwart** | Modern open-source mail server written in Rust |
| **VPS** | Virtual Private Server - a cloud server you rent |
| **Deliverability** | Whether your emails reach recipients' inboxes (vs spam) |
| **IP Reputation** | Trust score assigned to an IP address by email providers |
| **Blacklist** | Database of IPs known to send spam |

---

*Plan compiled from Product Designer, Developer, DevOps Specialist, Marketer, and Technical Writer research teams. February 2026.*
