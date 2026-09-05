# Configuration Reference

All MyMail configuration is managed through the `.env` file in the project root. This file is created from `.env.example` during setup and contains every configurable parameter.

---

## Table of Contents

- [Environment File Location](#environment-file-location)
- [Domain Configuration](#domain-configuration)
- [Admin Account](#admin-account)
- [Outbound Relay](#outbound-relay)
- [Backup Configuration](#backup-configuration)
- [Restic Encryption](#restic-encryption)
- [Docker Compose Overrides](#docker-compose-overrides)
- [Stalwart Mail Server Configuration](#stalwart-mail-server-configuration)
- [Rspamd Spam Filter Configuration](#rspamd-spam-filter-configuration)
- [Roundcube Webmail Configuration](#roundcube-webmail-configuration)
- [Caddy Reverse Proxy Configuration](#caddy-reverse-proxy-configuration)
- [Resource Limits](#resource-limits)
- [Applying Changes](#applying-changes)

---

## Environment File Location

```
mymail/
  .env              <-- Your active configuration (not committed to git)
  .env.example      <-- Template with default values and documentation
```

To create the `.env` file manually (instead of using `setup.sh`):

```bash
cp .env.example .env
```

Then edit `.env` with your values.

---

## Domain Configuration

| Variable | Description | Default | Example |
|---|---|---|---|
| `DOMAIN` | Your base domain for email addresses. This is the part after the `@` in email addresses. | `example.com` | `mycompany.com` |
| `HOSTNAME` | The fully qualified hostname of the mail server. Must have an A record and a PTR record pointing to `SERVER_IP`. | `mail.example.com` | `mail.mycompany.com` |
| `SERVER_IP` | The public IPv4 address of the server. Used by DNS validation scripts and health checks. | `0.0.0.0` | `203.0.113.50` |

**Example:**

```bash
DOMAIN=mycompany.com
HOSTNAME=mail.mycompany.com
SERVER_IP=203.0.113.50
```

**Notes:**
- `HOSTNAME` is typically `mail.DOMAIN` but can be any subdomain.
- The A record for `HOSTNAME` must resolve to `SERVER_IP`.
- The PTR record for `SERVER_IP` must resolve back to `HOSTNAME` (set through your hosting provider).

---

## Admin Account

| Variable | Description | Default | Example |
|---|---|---|---|
| `ADMIN_EMAIL` | The initial administrator email address created during first run. This account is used to log into webmail and the admin dashboard. | `admin@example.com` | `admin@mycompany.com` |
| `ADMIN_PASSWORD` | Password for the admin account. If left as `changeme`, `setup.sh` will generate a secure random password. | `changeme` | `xK9mP2vR7nQ4wL5j` |

**Example:**

```bash
ADMIN_EMAIL=admin@mycompany.com
ADMIN_PASSWORD=xK9mP2vR7nQ4wL5j
```

**Notes:**
- The admin password is stored in plain text in `.env`. Ensure the file is readable only by root (`chmod 600 .env`).
- To change the admin password after initial setup, update it in `.env` and restart Stalwart: `docker compose restart stalwart`.
- Additional email accounts can be created through the admin dashboard at `https://admin.DOMAIN`.

---

## Outbound Relay

An outbound relay routes your outgoing emails through a third-party SMTP service. This is strongly recommended for new servers because fresh IP addresses often have poor email reputation, causing messages to land in spam folders.

| Variable | Description | Default | Example |
|---|---|---|---|
| `RELAY_ENABLED` | Whether to route outbound mail through the relay. Set to `true` to enable. | `true` | `true` |
| `RELAY_HOST` | SMTP hostname of the relay provider. | `email-smtp.us-east-1.amazonaws.com` | `smtp.sendgrid.net` |
| `RELAY_PORT` | SMTP port for the relay. Use `587` for STARTTLS or `465` for implicit TLS. | `587` | `587` |
| `RELAY_USER` | SMTP username or access key for authentication with the relay. | *(empty)* | `AKIAIOSFODNN7EXAMPLE` |
| `RELAY_PASSWORD` | SMTP password or secret key for authentication with the relay. | *(empty)* | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLE` |
| `RELAY_STARTTLS` | Whether to use STARTTLS (`true`) or implicit TLS (`false`). Use `true` for port 587, `false` for port 465. | `true` | `true` |

**Example with Amazon SES:**

```bash
RELAY_ENABLED=true
RELAY_HOST=email-smtp.us-east-1.amazonaws.com
RELAY_PORT=587
RELAY_USER=AKIAIOSFODNN7EXAMPLE
RELAY_PASSWORD=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLE
RELAY_STARTTLS=true
```

**Example with SendGrid:**

```bash
RELAY_ENABLED=true
RELAY_HOST=smtp.sendgrid.net
RELAY_PORT=587
RELAY_USER=apikey
RELAY_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxxxxxx
RELAY_STARTTLS=true
```

**Example with no relay (direct delivery):**

```bash
RELAY_ENABLED=false
```

For detailed setup instructions for each relay provider, see [RELAY_SETUP.md](RELAY_SETUP.md).

---

## Backup Configuration

Backups use Restic to encrypt and upload data to S3-compatible object storage.

| Variable | Description | Default | Example |
|---|---|---|---|
| `BACKUP_ENABLED` | Whether automatic daily backups are enabled. | `true` | `true` |
| `BACKUP_S3_ENDPOINT` | Hostname of the S3-compatible storage endpoint. Do not include the protocol prefix. | `s3.us-west-000.backblazeb2.com` | `s3.amazonaws.com` |
| `BACKUP_S3_BUCKET` | Name of the storage bucket for backups. | `mymail-backups` | `my-email-backups` |
| `BACKUP_S3_KEY` | Access key ID for S3 authentication. | *(empty)* | `000a1b2c3d4e5f0000000000` |
| `BACKUP_S3_SECRET` | Secret access key for S3 authentication. | *(empty)* | `K000abcdefghijklmnopqrstuvwxyz` |
| `BACKUP_SCHEDULE` | Cron expression for when backups run. Default is 2:00 AM daily. | `0 2 * * *` | `0 3 * * *` |
| `BACKUP_RETENTION` | Number of days to retain backups before pruning. | `30` | `90` |

**Example with Backblaze B2:**

```bash
BACKUP_ENABLED=true
BACKUP_S3_ENDPOINT=s3.us-west-000.backblazeb2.com
BACKUP_S3_BUCKET=mymail-backups
BACKUP_S3_KEY=000a1b2c3d4e5f0000000000
BACKUP_S3_SECRET=K000abcdefghijklmnopqrstuvwxyz
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION=30
```

**Example with AWS S3:**

```bash
BACKUP_ENABLED=true
BACKUP_S3_ENDPOINT=s3.us-east-1.amazonaws.com
BACKUP_S3_BUCKET=my-email-backups
BACKUP_S3_KEY=AKIAIOSFODNN7EXAMPLE
BACKUP_S3_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLE
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION=30
```

For full backup setup instructions, see [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

---

## Restic Encryption

| Variable | Description | Default | Example |
|---|---|---|---|
| `RESTIC_PASSWORD` | Password used to encrypt all backup data. Auto-generated by `setup.sh` if left empty. | *(empty)* | `a1b2c3d4e5f6g7h8i9j0...` |

**Critical:** If you lose the `RESTIC_PASSWORD`, your backups cannot be decrypted. Store it securely in a password manager separately from your server.

---

## Docker Compose Overrides

MyMail includes two Compose files:

| File | Purpose |
|---|---|
| `docker-compose.yml` | Production configuration |
| `docker-compose.dev.yml` | Development configuration with relaxed settings |

For development:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

---

## Stalwart Mail Server Configuration

The Stalwart configuration file is at `stalwart/config/config.toml`. Key settings:

### Listeners

| Listener | Bind | Protocol | TLS |
|---|---|---|---|
| `smtp` | `[::]:25` | SMTP (inbound) | STARTTLS optional |
| `smtps` | `[::]:465` | SMTP (submission) | Implicit TLS |
| `submission` | `[::]:587` | SMTP (submission) | STARTTLS |
| `imaps` | `[::]:993` | IMAP | Implicit TLS |
| `jmap` | `[::]:8080` | HTTP (JMAP API) | None (internal) |
| `sieve` | `[::]:4190` | ManageSieve | STARTTLS |

### Rate Limits

| Limit | Scope | Rate |
|---|---|---|
| Inbound | Per remote IP | 25 messages / hour, 5 concurrent |
| Outbound (auth) | Per authenticated user | 100 messages / hour, 10 concurrent |
| Outbound (rcpt) | Per recipient domain | 50 messages / hour |

### Message Limits

| Setting | Value |
|---|---|
| Max message size | 25 MB |
| Max messages per session | 10 |
| Max received headers | 50 |
| Session timeout | 5 minutes |
| Session duration | 10 minutes |

### DKIM Signing

Two signatures are applied to outgoing messages:

| Selector | Algorithm | Key File |
|---|---|---|
| `mail` | Ed25519-SHA256 | `stalwart/config/dkim/private.key` |
| `mail-rsa` | RSA-SHA256 | `stalwart/config/dkim/rsa-private.key` |

### Authentication

- Mechanisms: PLAIN, LOGIN
- Fail2ban: 101 failed attempts per day triggers a ban
- Directory: Internal (SQLite-backed)

---

## Rspamd Spam Filter Configuration

Rspamd configuration files are in `rspamd/local.d/`. Key settings:

### Spam Score Thresholds (`actions.conf`)

| Action | Score | Behavior |
|---|---|---|
| No action | Below 4 | Message delivered normally |
| Greylist | 4+ | Message temporarily deferred |
| Add header | 6+ | Message delivered with spam headers |
| Reject | 15+ | Message rejected outright |

### Bayesian Classifier (`classifier-bayes.conf`)

- Backend: Redis
- Autolearn: Enabled
- Spam threshold: 6.0
- Ham threshold: -0.5

### Milter Headers (`milter_headers.conf`)

Added to processed messages:
- `X-Spamd-Bar` -- Visual spam score indicator
- `X-Spam-Level` -- Numeric spam level
- `Authentication-Results` -- SPF/DKIM/DMARC results

Headers are skipped for locally originated and authenticated messages.

---

## Roundcube Webmail Configuration

Configuration file: `roundcube/config/config.inc.php`

| Setting | Value |
|---|---|
| Skin | `elastic` (modern responsive) |
| Language | `en_US` |
| Session lifetime | 30 minutes |
| Upload limit | 25 MB |
| HTML editor | Always enabled |
| Draft autosave | 60 seconds |
| Plugins | `archive`, `zipdownload`, `managesieve` |

---

## Caddy Reverse Proxy Configuration

Configuration file: `caddy/Caddyfile`

Caddy handles three virtual hosts:

| Host | Backend | Purpose |
|---|---|---|
| `HOSTNAME` (e.g., `mail.example.com`) | `roundcube:9000` (FastCGI) | Webmail |
| `admin.DOMAIN` (e.g., `admin.example.com`) | `admin-ui:3000` (HTTP proxy) | Admin dashboard |
| `jmap.DOMAIN` (e.g., `jmap.example.com`) | `stalwart:8080` (HTTP proxy) | JMAP API / autodiscover |

All hosts get:
- Automatic TLS via Let's Encrypt
- HSTS with preload
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Gzip and Zstd compression
- Access logging with 10 MB rotation

---

## Resource Limits

Default Docker resource limits per container:

| Container | Memory | CPU |
|---|---|---|
| Caddy | 256 MB | 0.5 cores |
| Stalwart | 1 GB | 1.0 cores |
| Rspamd | 512 MB | 0.5 cores |
| Redis | 192 MB | 0.25 cores |
| Roundcube | 256 MB | 0.5 cores |
| Admin UI | 256 MB | 0.5 cores |
| **Total** | **~2.5 GB** | **~2.75 cores** |

To adjust limits, edit `docker-compose.yml` under each service's `deploy.resources.limits` section.

---

## Applying Changes

After editing `.env` or any configuration file:

```bash
# Restart all services to pick up changes
docker compose down
docker compose up -d

# Or restart a single service
docker compose restart stalwart
docker compose restart rspamd
docker compose restart caddy
```

To verify the new configuration took effect:

```bash
# Check container status
docker compose ps

# View logs for a specific service
docker compose logs -f stalwart
docker compose logs -f rspamd

# Run the health check
./scripts/health-check.sh
```
