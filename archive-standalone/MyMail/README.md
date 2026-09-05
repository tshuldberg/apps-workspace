# MyMail

> Your email. Your server. Your rules.

```
  __  __       __  __       _ _
 |  \/  |_   _|  \/  | __ _(_) |
 | |\/| | | | | |\/| |/ _` | | |
 | |  | | |_| | |  | | (_| | | |
 |_|  |_|\__, |_|  |_|\__,_|_|_|
         |___/
```

MyMail is a self-hosted personal email system that gives you complete ownership
and privacy over your email. Deploy your own private email server in under
30 minutes with our guided setup wizard.

No third-party access to your inbox. No ads. No scanning. Just your email,
on your server, under your control.

## Features

- **Private email on your own domain** -- Full control over your email address and data
- **Web-based admin dashboard** -- Manage accounts, domains, spam, and health from a modern UI
- **Setup wizard** -- Guided deployment with automatic configuration and DKIM key generation
- **Automatic TLS/HTTPS** -- Let's Encrypt certificates via Caddy, zero configuration
- **Spam filtering** -- Rspamd with Bayesian learning and real-time blacklist checks
- **Webmail access** -- Roundcube webmail, accessible from any browser
- **Automatic daily backups** -- Restic-based encrypted backups to S3-compatible storage
- **Outbound relay support** -- Route through Amazon SES, SendGrid, or any SMTP relay
- **AI-assisted monitoring** -- Health checks, DNS validation, and troubleshooting tools

## Architecture

```
                          Internet
                             |
                      +------+------+
                      |    Caddy    |  :80/:443 - Reverse Proxy + Auto-TLS
                      +------+------+
                             |
              +--------------+--------------+
              |              |              |
       +------+---+   +-----+----+   +-----+----+
       | Stalwart |   | Roundcube|   | Admin UI |
       |  Mail    |   | Webmail  |   | SvelteKit|
       +------+---+   +----------+   +----------+
              |          :25/:465/:587/:993
              |
       +------+---+
       |  Rspamd  |  Spam filtering via milter
       +------+---+
              |
       +------+---+
       |   Redis  |  Cache + Bayes backend
       +----------+

  Volumes: stalwart_data, caddy_data, rspamd_data, redis_data,
           roundcube_data, caddy_config
```

| Component   | Role                          | Port(s)              |
|-------------|-------------------------------|----------------------|
| Caddy       | Reverse proxy, auto-TLS       | 80, 443              |
| Stalwart    | SMTP, IMAP, JMAP mail server  | 25, 465, 587, 993, 4190 |
| Rspamd      | Spam filtering (milter)       | 11332 (internal)     |
| Redis       | Cache, Bayes backend          | 6379 (internal)      |
| Roundcube   | Webmail (PHP-FPM)             | 9000 (internal)      |
| Admin UI    | Management dashboard          | 3000 (internal)      |

## Quick Start

```bash
# 1. Get a VPS with 2GB+ RAM ($5/month from Hetzner, DigitalOcean, or Vultr)
# 2. Point your domain's DNS to the server IP
# 3. Clone this repo
git clone https://github.com/yourusername/mymail.git
cd mymail

# 4. Run the setup script
chmod +x scripts/setup.sh
./scripts/setup.sh

# 5. Follow the setup wizard prompts
#    - Enter your domain name
#    - Configure DNS records (the script tells you exactly what to add)
#    - Wait for services to start
```

For detailed instructions, see the [Quick Start Guide](docs/QUICKSTART.md).

## Requirements

| Requirement           | Details                                              |
|-----------------------|------------------------------------------------------|
| VPS                   | 2 GB+ RAM, 20 GB+ disk (Hetzner, DigitalOcean, Vultr) |
| Domain name           | Any registrar (Cloudflare, Namecheap, etc.)          |
| Docker                | Docker Engine 24+ with Compose v2                    |
| Operating system      | Ubuntu 22.04+ or Debian 12+ recommended              |
| Outbound relay (opt.) | Amazon SES, SendGrid, Mailgun, or Postmark           |

## Installation

### 1. Provision a VPS

Get a VPS with at least 2 GB RAM. Recommended providers:

- **Hetzner** (EU/US) -- CX22 at ~$4.50/month
- **DigitalOcean** -- Basic Droplet at $6/month
- **Vultr** -- Regular Cloud Compute at $6/month

### 2. Install Docker

```bash
# Ubuntu/Debian one-liner
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group membership to take effect
```

### 3. Clone and Run Setup

```bash
git clone https://github.com/yourusername/mymail.git
cd mymail
chmod +x scripts/*.sh
./scripts/setup.sh
```

The setup wizard will:
1. Check prerequisites (Docker, Docker Compose, OpenSSL)
2. Ask for your domain, hostname, and server IP
3. Generate a secure admin password
4. Generate DKIM signing keys (Ed25519 + RSA)
5. Display all required DNS records
6. Start all services

### 4. Configure DNS

Add the DNS records displayed by the setup script. See [DNS Setup Guide](docs/DNS_SETUP.md) for provider-specific instructions.

### 5. Verify

```bash
# Run the health check
./scripts/health-check.sh

# Validate DNS records
./scripts/dns-validate.sh
```

## Configuration

All configuration is managed through the `.env` file. See [Configuration Reference](docs/CONFIGURATION.md) for the full list of options.

Key settings:

```bash
DOMAIN=example.com           # Your base domain
HOSTNAME=mail.example.com    # Mail server hostname
ADMIN_EMAIL=admin@example.com
RELAY_ENABLED=true           # Use an outbound relay
BACKUP_ENABLED=true          # Enable automatic backups
```

## Mobile & Desktop Setup

MyMail works with any standard email client via IMAP and SMTP:

| Setting        | Value                    |
|----------------|--------------------------|
| IMAP server    | mail.yourdomain.com      |
| IMAP port      | 993 (SSL/TLS)            |
| SMTP server    | mail.yourdomain.com      |
| SMTP port      | 465 (SSL/TLS) or 587 (STARTTLS) |
| Username       | your full email address   |

See [Mobile Setup Guide](docs/MOBILE_SETUP.md) for step-by-step client instructions.

## Backup & Restore

Automatic encrypted backups run daily using Restic to S3-compatible storage (Backblaze B2, AWS S3, MinIO).

```bash
# Manual backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh
```

See [Backup & Restore Guide](docs/BACKUP_RESTORE.md) for full details.

## Documentation

| Document                                        | Description                        |
|-------------------------------------------------|------------------------------------|
| [Quick Start](docs/QUICKSTART.md)               | First deployment walkthrough       |
| [Configuration](docs/CONFIGURATION.md)          | All configuration options          |
| [DNS Setup](docs/DNS_SETUP.md)                  | DNS records and provider guides    |
| [Relay Setup](docs/RELAY_SETUP.md)              | Outbound relay configuration       |
| [Backup & Restore](docs/BACKUP_RESTORE.md)      | Backup and restore procedures      |
| [Troubleshooting](docs/TROUBLESHOOTING.md)      | Common issues and solutions        |
| [Security](docs/SECURITY.md)                    | Hardening and security guide       |
| [Architecture](docs/ARCHITECTURE.md)            | Technical deep-dive                |
| [Mobile Setup](docs/MOBILE_SETUP.md)            | Client configuration               |
| [Migration](docs/MIGRATION.md)                  | Migrate from Gmail, Outlook, etc.  |

## FAQ

**How much does it cost to run?**
A basic VPS costs $4-6/month. Domain registration is $10-15/year. Optional relay services (SES) cost fractions of a cent per email. Total: roughly $5-7/month.

**Will my emails go to spam?**
Using an outbound relay like Amazon SES greatly improves deliverability. Combined with proper DNS records (SPF, DKIM, DMARC) and a clean IP, your emails should land in the inbox.

**Can I host email for multiple domains?**
Yes. Stalwart supports multiple domains. Add them through the admin dashboard and configure DNS for each.

**Is it secure?**
MyMail uses TLS everywhere, fail2ban-style rate limiting, SPF/DKIM/DMARC authentication, and encrypted backups. See the [Security Guide](docs/SECURITY.md) for hardening tips.

**Can I migrate from Gmail?**
Yes. See the [Migration Guide](docs/MIGRATION.md) for step-by-step instructions using Google Takeout and IMAP sync.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MyMail is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This means you can freely use, modify, and distribute MyMail, but any network-accessible modifications must also be open-sourced under AGPL-3.0.
