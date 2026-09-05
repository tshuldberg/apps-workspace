# Architecture

This document provides a technical deep-dive into how MyMail components work together, how email flows through the system, and how the Docker infrastructure is organized.

---

## Table of Contents

- [System Overview](#system-overview)
- [Component Details](#component-details)
  - [Caddy (Reverse Proxy)](#caddy-reverse-proxy)
  - [Stalwart (Mail Server)](#stalwart-mail-server)
  - [Rspamd (Spam Filter)](#rspamd-spam-filter)
  - [Redis (Cache and Backend)](#redis-cache-and-backend)
  - [Roundcube (Webmail)](#roundcube-webmail)
  - [Admin UI (SvelteKit Dashboard)](#admin-ui-sveltekit-dashboard)
- [Email Flow: Inbound](#email-flow-inbound)
- [Email Flow: Outbound](#email-flow-outbound)
- [Email Flow: Webmail](#email-flow-webmail)
- [Docker Networking](#docker-networking)
- [Volume Layout](#volume-layout)
- [TLS Certificate Flow](#tls-certificate-flow)
- [Service Dependencies and Startup Order](#service-dependencies-and-startup-order)
- [Resource Allocation](#resource-allocation)
- [Storage Architecture](#storage-architecture)

---

## System Overview

```
                            Internet
                               |
                        +------+------+
                        |    Caddy    |  :80, :443 (HTTP/HTTPS)
                        |  (reverse   |  Automatic TLS via Let's Encrypt
                        |   proxy)    |  Security headers, compression
                        +------+------+
                               |
            +------------------+------------------+
            |                  |                  |
     +------+------+   +------+------+   +-------+-----+
     |  Stalwart   |   |  Roundcube  |   |  Admin UI   |
     | Mail Server |   |  (Webmail)  |   | (SvelteKit) |
     +------+------+   +------+------+   +-------------+
            |                  |
            |           FastCGI :9000         HTTP :3000
            |          (internal only)      (internal only)
     :25, :465, :587, :993, :4190
     (exposed to internet)
            |
     +------+------+
     |   Rspamd    |  Milter protocol :11332
     | Spam Filter |  (internal only)
     +------+------+
            |
     +------+------+
     |    Redis     |  :6379
     |   (cache)    |  (internal only)
     +-------------+
```

---

## Component Details

### Caddy (Reverse Proxy)

| Property | Value |
|---|---|
| Image | `caddy:2-alpine` |
| Container name | `mymail-caddy` |
| Exposed ports | 80 (HTTP), 443 (HTTPS + HTTP/3 UDP) |
| Memory limit | 256 MB |
| Config file | `caddy/Caddyfile` |

Caddy serves three roles:

1. **TLS termination** -- Obtains and renews Let's Encrypt certificates automatically. Shares certificates with Stalwart via the `caddy_data` volume.

2. **Reverse proxy** -- Routes incoming HTTPS traffic to the correct backend:
   - `mail.example.com` routes to Roundcube via FastCGI on port 9000
   - `admin.example.com` routes to Admin UI via HTTP on port 3000
   - `jmap.example.com` routes to Stalwart's JMAP API on port 8080

3. **Security headers** -- Adds HSTS, CSP, X-Frame-Options, and other headers to all responses.

Caddy does NOT proxy mail traffic (SMTP, IMAP). Those protocols connect directly to Stalwart.

### Stalwart (Mail Server)

| Property | Value |
|---|---|
| Image | `stalwartlabs/mail-server:latest` |
| Container name | `mymail-stalwart` |
| Exposed ports | 25, 465, 587, 993, 4190 |
| Internal ports | 8080 (JMAP API, proxied by Caddy) |
| Memory limit | 1 GB |
| Config file | `stalwart/config/config.toml` |

Stalwart is the core mail server handling:

- **SMTP (port 25)** -- Inbound server-to-server email
- **SMTPS (port 465)** -- Outbound submission with implicit TLS
- **SMTP Submission (port 587)** -- Outbound submission with STARTTLS
- **IMAPS (port 993)** -- Email retrieval with implicit TLS
- **ManageSieve (port 4190)** -- Server-side mail filtering rules
- **JMAP (port 8080, internal)** -- Modern mail API, proxied through Caddy

**Storage:** Stalwart uses SQLite for metadata/indexes and the filesystem for message blobs. All data is stored in the `stalwart_data` Docker volume at `/opt/stalwart-mail/`.

**User directory:** The internal directory (SQLite-backed) stores user accounts, passwords, and mailbox configurations.

**DKIM signing:** Every outgoing message is signed with both Ed25519 and RSA keys. The keys are stored in `stalwart/config/dkim/`.

**Relay integration:** When `RELAY_ENABLED=true`, outbound messages are forwarded to the configured SMTP relay instead of being delivered directly.

### Rspamd (Spam Filter)

| Property | Value |
|---|---|
| Image | `rspamd/rspamd:latest` |
| Container name | `mymail-rspamd` |
| Internal ports | 11332 (milter), 11333 (HTTP controller) |
| Memory limit | 512 MB |
| Config directory | `rspamd/local.d/` |

Rspamd integrates with Stalwart via the milter protocol. When Stalwart receives an inbound message on port 25, it sends the message to Rspamd on port 11332 for spam scoring before accepting it.

**Scoring actions:**

| Score Range | Action |
|---|---|
| Below 4 | Deliver normally |
| 4 - 5.9 | Greylist (temporary defer) |
| 6 - 14.9 | Add spam headers, deliver to inbox |
| 15+ | Reject outright |

**Checks performed:**
- SPF, DKIM, and DMARC validation of the sender
- Real-time blacklist lookups (Spamhaus, SpamCop, Barracuda, SORBS)
- Bayesian classification (learns from user feedback)
- URL analysis and content heuristics
- Greylisting for unknown senders

**Milter headers:** Rspamd adds `X-Spamd-Bar`, `X-Spam-Level`, and `Authentication-Results` headers to processed messages. These are skipped for locally originated and authenticated messages.

### Redis (Cache and Backend)

| Property | Value |
|---|---|
| Image | `redis:7-alpine` |
| Container name | `mymail-redis` |
| Internal ports | 6379 |
| Memory limit | 192 MB (128 MB maxmemory for Redis) |

Redis serves as:

1. **Rspamd statistics backend** -- Stores Bayesian classifier training data (spam/ham word frequencies)
2. **Rate limiting state** -- Tracks per-IP and per-sender rates
3. **Greylisting database** -- Tracks sender/recipient pairs for greylist decisions

Redis is configured with:
- `maxmemory 128mb` with `allkeys-lru` eviction policy
- Persistence: saves to disk every 60 seconds if 1000+ keys changed
- Data stored in the `redis_data` volume

### Roundcube (Webmail)

| Property | Value |
|---|---|
| Image | `roundcube/roundcubemail:latest-fpm` |
| Container name | `mymail-roundcube` |
| Internal ports | 9000 (PHP-FPM) |
| Memory limit | 256 MB |
| Config file | `roundcube/config/config.inc.php` |

Roundcube provides browser-based email access:

- Connects to Stalwart via IMAP (SSL on port 993) for reading mail
- Connects to Stalwart via SMTP (STARTTLS on port 587) for sending mail
- Uses SQLite for local data (contacts, settings, identities)
- Runs as PHP-FPM, served by Caddy via FastCGI
- Plugins: `archive`, `zipdownload`, `managesieve`

### Admin UI (SvelteKit Dashboard)

| Property | Value |
|---|---|
| Image | Built from `admin-ui/Dockerfile` |
| Container name | `mymail-admin` |
| Internal ports | 3000 (HTTP) |
| Memory limit | 256 MB |

The admin dashboard is a SvelteKit application that communicates with Stalwart's JMAP API (port 8080) to manage:

- User accounts (create, delete, modify)
- Domain configuration
- Email statistics
- Spam filter status
- Backup management
- Server health

The Admin UI is served by Caddy at `admin.example.com`.

---

## Email Flow: Inbound

When someone sends you an email, the following happens:

```
1. Sender's mail server looks up MX record for example.com
   -> Resolves to mail.example.com -> 203.0.113.50

2. Sender connects to 203.0.113.50:25 (SMTP)
   -> Connection reaches Stalwart container directly (port mapped)

3. Stalwart performs initial checks:
   - EHLO/HELO validation
   - Rate limiting check (25/hour per IP, 5 concurrent)
   - Recipient validation (does the address exist?)

4. Stalwart passes message to Rspamd via milter (port 11332):
   a. Rspamd checks SPF (is sender authorized?)
   b. Rspamd checks DKIM (is message signature valid?)
   c. Rspamd checks DMARC (does policy allow this?)
   d. Rspamd queries blacklists (Spamhaus, SpamCop, etc.)
   e. Rspamd runs Bayesian classifier (trained spam/ham model)
   f. Rspamd calculates total spam score

5. Based on Rspamd's score:
   - Score < 4: Accept normally
   - Score 4-5.9: Greylist (send temporary rejection, legitimate servers retry)
   - Score 6-14.9: Accept with X-Spam-* headers added
   - Score >= 15: Reject (550 error returned to sender)

6. If accepted, Stalwart:
   - Stores the message in the user's mailbox (SQLite index + filesystem blob)
   - Runs any Sieve filters the user has configured
   - Message is available immediately via IMAP and JMAP

7. User reads the message via:
   - Roundcube webmail (HTTPS -> Caddy -> Roundcube -> IMAP -> Stalwart)
   - Desktop/mobile client (IMAPS -> port 993 -> Stalwart)
```

---

## Email Flow: Outbound

When you send an email:

```
1. User composes message in:
   - Roundcube (connects to Stalwart via SMTP port 587 internally)
   - Desktop/mobile client (connects to port 465 or 587 externally)

2. Client authenticates with email + password
   - Stalwart validates credentials against internal directory
   - Rate limit checked (100 messages/hour per user)

3. Stalwart signs the message:
   - Ed25519 DKIM signature (selector: mail)
   - RSA DKIM signature (selector: mail-rsa)

4a. If RELAY_ENABLED=true:
    - Message is forwarded to the relay (e.g., SES at port 587)
    - Relay authenticates using RELAY_USER/RELAY_PASSWORD
    - Relay delivers the message to the recipient's server
    - Relay handles bounce processing

4b. If RELAY_ENABLED=false:
    - Stalwart looks up the recipient's MX record
    - Connects to the recipient's mail server on port 25
    - Delivers the message directly

5. If delivery fails:
   - Stalwart queues the message for retry
   - Retry schedule: 2m, 5m, 10m, 15m, 30m, 1h, 2h
   - Notification to sender after 1 day and 3 days
   - Final expiration after 5 days (bounce sent to sender)
```

---

## Email Flow: Webmail

```
Browser                  Caddy                 Roundcube              Stalwart
  |                        |                       |                      |
  |-- HTTPS request ------>|                       |                      |
  |   mail.example.com     |                       |                      |
  |                        |-- FastCGI :9000 ----->|                      |
  |                        |                       |-- IMAP :993 -------->|
  |                        |                       |   (read messages)    |
  |                        |                       |<-- messages ---------|
  |                        |<-- HTML response -----|                      |
  |<-- HTTPS response -----|                       |                      |
  |                        |                       |                      |
  |-- Send email --------->|                       |                      |
  |                        |-- FastCGI :9000 ----->|                      |
  |                        |                       |-- SMTP :587 -------->|
  |                        |                       |   (send message)     |
  |                        |                       |<-- OK ---------------|
  |                        |<-- success ---------- |                      |
  |<-- HTTPS response -----|                       |                      |
```

---

## Docker Networking

All containers share a single Docker bridge network:

```
Network: mail-network
Subnet:  172.28.0.0/16
Driver:  bridge
```

**Container DNS resolution:** Docker's internal DNS allows containers to reach each other by name. For example, Roundcube connects to `stalwart:993` using the container name.

**Port exposure:**

| Port | Protocol | Exposed to Internet | Service |
|---|---|---|---|
| 80 | TCP | Yes | Caddy (HTTP, redirects to HTTPS) |
| 443 | TCP + UDP | Yes | Caddy (HTTPS + HTTP/3) |
| 25 | TCP | Yes | Stalwart (SMTP inbound) |
| 465 | TCP | Yes | Stalwart (SMTPS) |
| 587 | TCP | Yes | Stalwart (SMTP submission) |
| 993 | TCP | Yes | Stalwart (IMAPS) |
| 4190 | TCP | Yes | Stalwart (ManageSieve) |
| 8080 | TCP | No (internal) | Stalwart (JMAP, accessed via Caddy) |
| 9000 | TCP | No (internal) | Roundcube (PHP-FPM, accessed via Caddy) |
| 3000 | TCP | No (internal) | Admin UI (HTTP, accessed via Caddy) |
| 11332 | TCP | No (internal) | Rspamd (milter, accessed by Stalwart) |
| 11333 | TCP | No (internal) | Rspamd (HTTP controller) |
| 6379 | TCP | No (internal) | Redis (accessed by Rspamd) |

---

## Volume Layout

Docker volumes persist data across container restarts:

```
Docker Volumes:
  mymail_stalwart_data    -> /opt/stalwart-mail        (Stalwart)
  mymail_caddy_data       -> /data                     (Caddy)
  mymail_caddy_config     -> /config                   (Caddy)
  mymail_rspamd_data      -> /var/lib/rspamd           (Rspamd)
  mymail_redis_data       -> /data                     (Redis)
  mymail_roundcube_data   -> /var/roundcube/db          (Roundcube)
  mymail_roundcube_temp   -> /tmp/roundcube             (Roundcube)

Bind Mounts (configuration files, read-only):
  ./caddy/Caddyfile             -> /etc/caddy/Caddyfile         (Caddy)
  ./stalwart/config/            -> /opt/stalwart-mail/etc       (Stalwart)
  ./rspamd/local.d/             -> /etc/rspamd/local.d          (Rspamd)
  ./roundcube/config/config.inc.php -> /var/roundcube/config/config.inc.php (Roundcube)

Shared Volume:
  mymail_caddy_data -> /caddy-data (Stalwart, read-only)
    Purpose: Shares TLS certificates from Caddy with Stalwart
```

### Volume Contents

**stalwart_data:**

```
/opt/stalwart-mail/
  data/
    index.sqlite3       # User accounts, mailbox metadata, full-text index
    blobs/              # Actual email message files
    queue/              # Outbound message queue
  logs/                 # Stalwart log files
```

**caddy_data:**

```
/data/
  caddy/
    certificates/
      acme-v02.api.letsencrypt.org-directory/
        mail.example.com/
          mail.example.com.crt    # TLS certificate
          mail.example.com.key    # TLS private key
    locks/
  logs/
    webmail-access.log
    admin-access.log
    jmap-access.log
```

**rspamd_data:**

```
/var/lib/rspamd/
  # Rspamd runtime data, learned rules, and symbol cache
```

**redis_data:**

```
/data/
  dump.rdb    # Redis persistence file (Bayes data, rate limit state)
```

**roundcube_data:**

```
/var/roundcube/db/
  roundcube.db    # SQLite database (contacts, identities, settings)
```

---

## TLS Certificate Flow

```
1. Caddy starts and checks for existing certificates in caddy_data volume

2. If certificates are missing or expired:
   a. Caddy requests certificates from Let's Encrypt (ACME HTTP-01 challenge)
   b. Let's Encrypt validates by connecting to port 80
   c. Certificates are stored in caddy_data volume

3. Stalwart reads certificates from caddy_data volume (mounted read-only at /caddy-data):
   /caddy-data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/
     mail.example.com/mail.example.com.crt
     mail.example.com/mail.example.com.key

4. If Caddy certificates are not available (e.g., during initial startup race):
   Stalwart falls back to its own ACME configuration (TLS-ALPN-01 challenge)

5. Certificate renewal:
   - Caddy renews certificates automatically before expiration
   - Stalwart picks up new certificates on the next TLS handshake
```

---

## Service Dependencies and Startup Order

Docker Compose manages the startup order based on `depends_on` with health checks:

```
Startup Order:
  1. Redis (no dependencies)
     -> healthcheck: redis-cli ping

  2. Rspamd (depends on: Redis healthy)
     -> healthcheck: curl http://localhost:11333/ping

  3. Stalwart (depends on: Rspamd healthy, Redis healthy)
     -> healthcheck: nc -z localhost 993

  4. Roundcube (depends on: Stalwart healthy)
     -> healthcheck: php-fpm-healthcheck

  5. Admin UI (depends on: Stalwart healthy)
     -> healthcheck: wget http://localhost:3000/health

  6. Caddy (no explicit dependencies, but backends must be running)
     -> healthcheck: wget http://localhost:80
```

All services use `restart: unless-stopped` to automatically recover from crashes.

---

## Resource Allocation

Total resource requirements for all containers:

| Container | Memory | CPU | Disk (typical) |
|---|---|---|---|
| Caddy | 256 MB | 0.50 cores | 100 MB (certs + logs) |
| Stalwart | 1 GB | 1.00 cores | 1-50 GB (depends on mail volume) |
| Rspamd | 512 MB | 0.50 cores | 200 MB (learned rules) |
| Redis | 192 MB | 0.25 cores | 50 MB (Bayes data) |
| Roundcube | 256 MB | 0.50 cores | 50 MB (SQLite + temp) |
| Admin UI | 256 MB | 0.50 cores | 50 MB (Node.js) |
| **Total** | **~2.5 GB** | **~3.25 cores** | **~2-51 GB** |

**Minimum recommended VPS:** 2 GB RAM, 2 vCPU, 20 GB disk (Hetzner CX22 or equivalent).

---

## Storage Architecture

Stalwart uses a dual-storage model:

```
SQLite (index.sqlite3):
  - User accounts and passwords
  - Mailbox structure (folders, flags)
  - Full-text search index
  - Message metadata (headers, dates, sizes)
  - Fast lookup and search operations

Filesystem (blobs/):
  - Actual email message content (RFC 5322 format)
  - Attachments stored within the message
  - Content-addressable storage (deduplication via hash)
  - Efficient for large messages and attachments
```

This architecture provides:
- Fast search and filtering via SQLite indexes
- Efficient storage via filesystem-level blob management
- Simple backup (copy SQLite file + blob directory)
- No dependency on external database servers (MySQL, PostgreSQL)
