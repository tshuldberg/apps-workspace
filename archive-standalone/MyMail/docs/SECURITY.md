# Security Hardening Guide

This guide covers security best practices for running MyMail in production. MyMail includes several security features out of the box, but additional hardening is recommended for internet-facing servers.

---

## Table of Contents

- [Security Overview](#security-overview)
- [Firewall Configuration (UFW)](#firewall-configuration-ufw)
- [Fail2Ban Setup](#fail2ban-setup)
- [SSH Hardening](#ssh-hardening)
- [Automatic Security Updates](#automatic-security-updates)
- [TLS Configuration](#tls-configuration)
- [Rate Limiting](#rate-limiting)
- [Docker Security](#docker-security)
- [File Permissions](#file-permissions)
- [Monitoring and Alerts](#monitoring-and-alerts)
- [Security Checklist](#security-checklist)

---

## Security Overview

MyMail includes the following security measures by default:

| Feature | Component | Configuration |
|---|---|---|
| Automatic TLS/HTTPS | Caddy | Let's Encrypt certificates, auto-renewal |
| HSTS with preload | Caddy | `Strict-Transport-Security` header |
| Security headers | Caddy | CSP, X-Frame-Options, X-Content-Type-Options |
| DKIM email signing | Stalwart | Ed25519 + RSA dual signing |
| SPF validation | DNS | Sender authorization |
| DMARC enforcement | DNS | Authentication policy |
| Spam filtering | Rspamd | Bayesian + real-time blacklists |
| Authentication rate limiting | Stalwart | 101 failed attempts per day = ban |
| Session rate limiting | Stalwart | Per-IP and per-user limits |
| Encrypted backups | Restic | AES-256 encryption with unique password |
| Internal-only services | Docker network | Redis, Rspamd, Roundcube not exposed |

---

## Firewall Configuration (UFW)

UFW (Uncomplicated Firewall) should be your first line of defense.

### Install and Enable

```bash
apt install -y ufw
```

### Configure Rules

```bash
# Default policy: deny incoming, allow outgoing
ufw default deny incoming
ufw default allow outgoing

# SSH (change port if you modified it)
ufw allow 22/tcp

# HTTP/HTTPS (Caddy)
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp    # HTTP/3

# Mail ports
ufw allow 25/tcp     # SMTP inbound
ufw allow 465/tcp    # SMTPS
ufw allow 587/tcp    # SMTP submission
ufw allow 993/tcp    # IMAPS
ufw allow 4190/tcp   # ManageSieve

# Enable the firewall
ufw enable
```

### Verify

```bash
ufw status verbose
```

Expected output:

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                    ALLOW IN    Anywhere
443/udp                    ALLOW IN    Anywhere
25/tcp                     ALLOW IN    Anywhere
465/tcp                    ALLOW IN    Anywhere
587/tcp                    ALLOW IN    Anywhere
993/tcp                    ALLOW IN    Anywhere
4190/tcp                   ALLOW IN    Anywhere
```

### Optional: Restrict SSH by IP

If you always connect from a static IP:

```bash
ufw delete allow 22/tcp
ufw allow from YOUR_HOME_IP to any port 22
```

---

## Fail2Ban Setup

Fail2Ban monitors log files and bans IPs that show malicious behavior (brute-force login attempts, repeated authentication failures).

### Install

```bash
apt install -y fail2ban
```

### Configure for SSH

Create `/etc/fail2ban/jail.local`:

```ini
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
banaction = ufw

[sshd]
enabled  = true
port     = ssh
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 86400
```

### Configure for Stalwart (SMTP/IMAP brute force)

Stalwart has built-in fail2ban-style rate limiting (101 failed attempts per day triggers a ban), but you can add an OS-level layer for additional protection.

Create `/etc/fail2ban/filter.d/stalwart.conf`:

```ini
[Definition]
failregex = ^.*Authentication failed.*remote=<HOST>.*$
ignoreregex =
```

Add to `/etc/fail2ban/jail.local`:

```ini
[stalwart]
enabled  = true
port     = 25,465,587,993,4190
filter   = stalwart
logpath  = /var/lib/docker/volumes/mymail_stalwart_data/_data/logs/stalwart*.log
maxretry = 10
bantime  = 3600
findtime = 600
```

### Start and Enable

```bash
systemctl enable fail2ban
systemctl start fail2ban
```

### Check Status

```bash
fail2ban-client status
fail2ban-client status sshd
fail2ban-client status stalwart
```

### Unban an IP

```bash
fail2ban-client set sshd unbanip 203.0.113.100
```

---

## SSH Hardening

### Disable Password Authentication

Ensure you have SSH key authentication working before disabling passwords.

1. **On your local machine**, generate an SSH key if you do not have one:
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```

2. **Copy the key to your server:**
   ```bash
   ssh-copy-id root@YOUR_SERVER_IP
   ```

3. **Verify key authentication works** by logging in without being prompted for a password.

4. **Disable password authentication.** Edit `/etc/ssh/sshd_config`:
   ```
   PasswordAuthentication no
   PubkeyAuthentication yes
   PermitRootLogin prohibit-password
   ```

5. **Restart SSH:**
   ```bash
   systemctl restart sshd
   ```

### Change SSH Port (Optional)

Using a non-standard port reduces automated scanning noise:

Edit `/etc/ssh/sshd_config`:

```
Port 2222
```

Update the firewall:

```bash
ufw allow 2222/tcp
ufw delete allow 22/tcp
systemctl restart sshd
```

Connect with:

```bash
ssh -p 2222 root@YOUR_SERVER_IP
```

### Disable Root Login (Optional)

Create a non-root user first:

```bash
adduser mymail
usermod -aG sudo mymail
usermod -aG docker mymail
```

Copy SSH keys to the new user:

```bash
mkdir -p /home/mymail/.ssh
cp /root/.ssh/authorized_keys /home/mymail/.ssh/
chown -R mymail:mymail /home/mymail/.ssh
```

Then set `PermitRootLogin no` in `/etc/ssh/sshd_config` and restart SSH.

---

## Automatic Security Updates

Enable unattended security upgrades so critical patches are applied automatically.

### Ubuntu/Debian

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

Verify it is enabled:

```bash
cat /etc/apt/apt.conf.d/20auto-upgrades
```

Expected contents:

```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

### Configure Email Notifications (Optional)

Edit `/etc/apt/apt.conf.d/50unattended-upgrades`:

```
Unattended-Upgrade::Mail "admin@example.com";
Unattended-Upgrade::MailReport "on-change";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
```

Set `Automatic-Reboot` to `false` to prevent unexpected downtime. Plan manual reboots for kernel updates during maintenance windows.

### Keep Docker Updated

Docker does not update through `unattended-upgrades` by default. Update it periodically:

```bash
apt update && apt install -y docker-ce docker-ce-cli containerd.io
```

---

## TLS Configuration

### Certificate Management

Caddy handles TLS certificates automatically via Let's Encrypt:

- Certificates are obtained on first startup
- Renewal happens automatically before expiration
- HTTP/2 and HTTP/3 are enabled by default
- TLS 1.2 and 1.3 are supported (older versions are disabled)

Stalwart shares Caddy's certificates via a Docker volume mount (`caddy_data`).

### Verify TLS Configuration

Test your TLS setup with external tools:

```bash
# Check certificate details
openssl s_client -connect mail.example.com:993 -servername mail.example.com </dev/null 2>/dev/null | openssl x509 -noout -dates -subject

# Check SMTP TLS
openssl s_client -connect mail.example.com:587 -starttls smtp -servername mail.example.com </dev/null 2>/dev/null | openssl x509 -noout -dates

# Check HTTPS
curl -vI https://mail.example.com 2>&1 | grep -E "SSL|TLS|issuer|expire"
```

### Online TLS Testing

- [SSL Labs](https://www.ssllabs.com/ssltest/) -- Test HTTPS configuration (enter `https://mail.example.com`)
- [CheckTLS](https://www.checktls.com/) -- Test SMTP TLS configuration
- [Internet.nl](https://internet.nl/) -- Comprehensive email security test

### HSTS Preload

MyMail's Caddy configuration includes HSTS with the `preload` directive:

```
Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
```

To submit your domain for HSTS preload (browsers will always use HTTPS):

1. Verify HSTS is working: `curl -I https://mail.example.com | grep Strict`
2. Submit at [hstspreload.org](https://hstspreload.org/)

---

## Rate Limiting

### Stalwart Rate Limits

MyMail configures these rate limits in `stalwart/config/config.toml`:

| Rule | Scope | Limit |
|---|---|---|
| Inbound connections | Per remote IP | 25 messages/hour, 5 concurrent |
| Authenticated sending | Per user | 100 messages/hour, 10 concurrent |
| Per-domain sending | Per recipient domain | 50 messages/hour |
| Auth failures | Per IP | 101 failures/day = ban |

To adjust these, edit `stalwart/config/config.toml` and restart Stalwart:

```bash
docker compose restart stalwart
```

### Rspamd Rate Limiting

Rspamd can also apply rate limits on inbound connections. To configure, create `rspamd/local.d/ratelimit.conf`:

```
# Rate limit inbound messages
rates {
    to = {
        # 50 messages per hour to any single recipient
        bucket {
            burst = 50;
            rate = "50/1h";
        }
    }
    from = {
        # 100 messages per hour from any single sender
        bucket {
            burst = 100;
            rate = "100/1h";
        }
    }
}
```

---

## Docker Security

### Run as Non-Root (Recommended)

Create a dedicated user for running Docker:

```bash
adduser --system --no-create-home mymail
usermod -aG docker mymail
```

### Keep Images Updated

Regularly pull the latest images to get security patches:

```bash
docker compose pull
docker compose up -d
```

### Limit Container Capabilities

The `docker-compose.yml` already includes resource limits. For additional hardening, you can add security options to each service:

```yaml
services:
  stalwart:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
```

### Network Isolation

MyMail uses a dedicated Docker bridge network (`mail-network` with subnet `172.28.0.0/16`). Internal services (Redis, Rspamd, Roundcube, Admin UI) are not exposed to the host network -- they are only accessible from within the Docker network.

Only these ports are exposed to the internet:
- 80, 443 (Caddy)
- 25, 465, 587, 993, 4190 (Stalwart)

---

## File Permissions

Ensure sensitive files have restrictive permissions:

```bash
# .env contains passwords
chmod 600 .env

# DKIM private keys
chmod 600 stalwart/config/dkim/private.key
chmod 600 stalwart/config/dkim/rsa-private.key

# Public keys can be world-readable
chmod 644 stalwart/config/dkim/public.key
chmod 644 stalwart/config/dkim/rsa-public.key

# Scripts should be executable but not writable by others
chmod 750 scripts/*.sh
```

---

## Monitoring and Alerts

### Uptime Monitoring

Use a free external monitoring service to alert you if your mail server goes down:

- [UptimeRobot](https://uptimerobot.com/) -- Free tier monitors 50 hosts every 5 minutes
- [Hetrix Tools](https://hetrixtools.com/) -- Free tier with SMTP port monitoring

Configure monitors for:
- HTTPS: `https://mail.example.com` (expect HTTP 200)
- SMTP: `mail.example.com:25` (expect connection)
- IMAP: `mail.example.com:993` (expect connection)

### Log Monitoring

Set up a cron job to check for errors daily:

```bash
# Add to crontab
0 8 * * * docker compose -f /path/to/mymail/docker-compose.yml logs --since 24h 2>&1 | grep -i "error\|fail\|critical" | mail -s "MyMail Daily Error Report" admin@example.com
```

### Disk Space Monitoring

```bash
# Alert when disk is over 80% full
0 */6 * * * [ $(df / --output=pcent | tail -1 | tr -d ' %') -gt 80 ] && echo "Disk space warning: $(df -h / | tail -1)" | mail -s "MyMail Disk Alert" admin@example.com
```

### Docker Health Monitoring

```bash
# Check container health every 5 minutes
*/5 * * * * docker compose -f /path/to/mymail/docker-compose.yml ps --format json 2>/dev/null | grep -q "unhealthy\|Exit" && echo "Unhealthy containers detected" | mail -s "MyMail Health Alert" admin@example.com
```

---

## Security Checklist

Use this checklist to verify your deployment is properly hardened:

### Network

- [ ] UFW firewall enabled with only required ports open
- [ ] No unnecessary services running on the server
- [ ] Cloud provider firewall configured (if applicable)
- [ ] Port 25 outbound tested for relay connectivity

### Authentication

- [ ] SSH key authentication enabled
- [ ] SSH password authentication disabled
- [ ] Root login restricted or disabled
- [ ] Strong admin password generated by setup.sh
- [ ] Fail2Ban installed and active for SSH and Stalwart

### TLS/Encryption

- [ ] HTTPS working on webmail and admin panel
- [ ] SMTP TLS working on ports 465 and 587
- [ ] IMAP TLS working on port 993
- [ ] SSL Labs score of A or A+ on `mail.example.com`
- [ ] HSTS headers present
- [ ] Backups encrypted with RESTIC_PASSWORD

### Email Authentication

- [ ] SPF record published and passing
- [ ] DKIM record(s) published and passing
- [ ] DMARC record published
- [ ] PTR record matches HOSTNAME

### System

- [ ] Operating system fully updated
- [ ] Unattended security upgrades enabled
- [ ] Docker images up to date
- [ ] File permissions restricted on .env and DKIM keys
- [ ] Uptime monitoring configured
- [ ] Backup working and verified
