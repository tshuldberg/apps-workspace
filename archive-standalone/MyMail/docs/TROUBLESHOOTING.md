# Troubleshooting Guide

This guide covers common issues you may encounter when running MyMail, along with diagnostic commands and solutions.

---

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Services Not Starting](#services-not-starting)
- [Emails Going to Spam](#emails-going-to-spam)
- [Cannot Receive Email](#cannot-receive-email)
- [Cannot Send Email](#cannot-send-email)
- [TLS and Certificate Errors](#tls-and-certificate-errors)
- [DNS Propagation Issues](#dns-propagation-issues)
- [Port Blocking](#port-blocking)
- [Rspamd Issues](#rspamd-issues)
- [Disk Space Issues](#disk-space-issues)
- [Performance Issues](#performance-issues)
- [Log Locations](#log-locations)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

Run these commands first to get an overview of system health:

```bash
# Check all container status
docker compose ps

# Run the health check
./scripts/health-check.sh

# Validate DNS records
./scripts/dns-validate.sh

# View recent logs from all services
docker compose logs --tail=50

# Check disk space
df -h
```

---

## Services Not Starting

### All containers are "Restarting" or "Exit"

**Check logs for the specific container:**

```bash
docker compose logs stalwart
docker compose logs rspamd
docker compose logs caddy
docker compose logs redis
docker compose logs roundcube
docker compose logs admin-ui
```

**Common causes:**

1. **Port conflict:** Another process is using a required port.

   ```bash
   # Check what is using port 25
   ss -tlnp | grep :25

   # Check all required ports
   for port in 25 80 443 465 587 993 4190; do
       ss -tlnp | grep ":$port " && echo "Port $port is in use"
   done
   ```

   Solution: Stop the conflicting service (often `postfix` or `exim4`):
   ```bash
   systemctl stop postfix
   systemctl disable postfix
   ```

2. **Insufficient memory:** The server does not have enough RAM.

   ```bash
   free -h
   ```

   MyMail requires approximately 2.5 GB of RAM. If your server has 1 GB, you need a larger instance.

3. **Docker not running:**

   ```bash
   systemctl status docker
   systemctl start docker
   ```

4. **Corrupt Docker volumes:**

   ```bash
   docker compose down
   docker volume ls | grep mymail
   # If needed, remove and recreate volumes (WARNING: data loss)
   docker compose up -d
   ```

### Stalwart container fails to start

**Check Stalwart logs:**

```bash
docker compose logs stalwart
```

**Common causes:**

- **Configuration syntax error in `config.toml`:** Look for TOML parsing errors in the log output. Validate the config:
  ```bash
  docker run --rm -v $(pwd)/stalwart/config:/config:ro stalwartlabs/mail-server:latest --config /config/config.toml --check
  ```

- **Missing DKIM keys:** The config references key files that do not exist.
  ```bash
  ls -la stalwart/config/dkim/
  ```
  If keys are missing, regenerate them:
  ```bash
  mkdir -p stalwart/config/dkim
  openssl genpkey -algorithm ED25519 -out stalwart/config/dkim/private.key
  openssl pkey -in stalwart/config/dkim/private.key -pubout -out stalwart/config/dkim/public.key
  openssl genrsa -out stalwart/config/dkim/rsa-private.key 2048
  openssl rsa -in stalwart/config/dkim/rsa-private.key -pubout -out stalwart/config/dkim/rsa-public.key
  chmod 600 stalwart/config/dkim/private.key stalwart/config/dkim/rsa-private.key
  ```

- **Rspamd or Redis not healthy yet:** Stalwart depends on Rspamd and Redis. Check their status:
  ```bash
  docker compose ps rspamd redis
  ```

### Caddy returns errors

```bash
docker compose logs caddy
```

- **"challenge failed" or ACME errors:** Your DNS A records must resolve to the server before Caddy can obtain TLS certificates. Verify:
  ```bash
  dig A mail.example.com +short
  dig A admin.example.com +short
  ```

- **"bind: address already in use":** Another web server (Apache, Nginx) is using port 80 or 443:
  ```bash
  ss -tlnp | grep -E ':80|:443'
  systemctl stop apache2 nginx
  systemctl disable apache2 nginx
  ```

### Redis container keeps restarting

```bash
docker compose logs redis
```

- **Out of memory:** Redis is configured with a 128 MB limit. If the system is low on RAM, Redis may be killed by the OOM killer.
  ```bash
  dmesg | grep -i oom
  ```

---

## Emails Going to Spam

This is the most common issue with self-hosted email. Work through these checks in order:

### 1. Check Your IP Reputation

```bash
./scripts/health-check.sh
```

The health check tests your IP against major blacklists. If your IP is listed:

- Check the listing reason at the blacklist's website
- For a new VPS IP that was previously used for spam, request delisting
- Consider using an outbound relay to bypass IP reputation issues (see [RELAY_SETUP.md](RELAY_SETUP.md))

### 2. Verify DNS Records

```bash
./scripts/dns-validate.sh
```

Every record must pass:
- **SPF** must include your server and relay (if used)
- **DKIM** must be published and match the signing key
- **DMARC** must exist
- **PTR** must match your `HOSTNAME`

### 3. Test with Mail-Tester

1. Go to [mail-tester.com](https://www.mail-tester.com/)
2. Copy the test address shown
3. Send an email from your webmail to that address
4. Check the score (aim for 9/10 or higher)

Mail-Tester will identify specific issues affecting your deliverability.

### 4. Check Email Headers

Send a test email to Gmail. In Gmail, open the message and click the three dots > "Show original". Check:

- **SPF:** Should show `pass`
- **DKIM:** Should show `pass` for your domain
- **DMARC:** Should show `pass`

### 5. Warm Up Your IP

If sending directly (no relay), you need to build IP reputation gradually:

- Start by sending only a few emails per day
- Send to contacts who will open and reply to your messages
- Avoid sending bulk or marketing-style emails initially
- IP warming typically takes 2-4 weeks

### 6. Use an Outbound Relay

The most reliable solution is routing through a relay service like Amazon SES. See [RELAY_SETUP.md](RELAY_SETUP.md).

---

## Cannot Receive Email

### Check that port 25 is open

```bash
# From the server
ss -tlnp | grep :25

# From outside (use a different machine)
telnet mail.example.com 25
```

If port 25 is not open, check the firewall:

```bash
ufw status
ufw allow 25/tcp
```

### Check MX record

```bash
dig MX example.com +short
```

The MX record must point to your `HOSTNAME` (e.g., `10 mail.example.com.`).

### Check Stalwart is accepting connections

```bash
# Test SMTP locally
docker exec mymail-stalwart sh -c "nc -z localhost 25 && echo OK"

# Check Stalwart logs for incoming connection attempts
docker compose logs stalwart | grep -i "incoming\|connect\|reject"
```

### Check Rspamd is not rejecting everything

```bash
docker compose logs rspamd | grep -i "reject\|block"
```

If Rspamd is rejecting legitimate mail, the score thresholds may be too aggressive. See the [Rspamd Issues](#rspamd-issues) section.

---

## Cannot Send Email

### Check Stalwart outbound queue

```bash
docker compose logs stalwart | grep -i "queue\|delivery\|send"
```

### If using a relay, check relay connectivity

```bash
# Test connection to relay
docker exec mymail-stalwart sh -c "nc -z -w5 email-smtp.us-east-1.amazonaws.com 587 && echo OK || echo FAIL"
```

### Check for authentication errors

```bash
docker compose logs stalwart | grep -i "auth\|credential\|denied"
```

### Check if port 25 outbound is blocked

Some VPS providers block outbound port 25 by default:

```bash
# Test outbound port 25
nc -z -w5 gmail-smtp-in.l.google.com 25 && echo "Port 25 outbound OK" || echo "Port 25 outbound BLOCKED"
```

If blocked, you must use an outbound relay. See [RELAY_SETUP.md](RELAY_SETUP.md).

---

## TLS and Certificate Errors

### Caddy cannot obtain certificates

```bash
docker compose logs caddy | grep -i "tls\|acme\|cert\|challenge"
```

**Common causes:**

1. **DNS not pointing to server yet:** Caddy needs the A record to be resolvable before it can complete the ACME challenge.
   ```bash
   dig A mail.example.com +short
   ```

2. **Port 80 blocked:** Let's Encrypt uses HTTP-01 challenges on port 80.
   ```bash
   ufw allow 80/tcp
   ```

3. **Rate limited:** Let's Encrypt has rate limits (50 certificates per domain per week). If you have been creating/destroying the setup repeatedly:
   - Wait for the rate limit to reset
   - Use the staging CA for testing: change `acme_ca` in `Caddyfile` to `https://acme-staging-v02.api.letsencrypt.org/directory`

### Stalwart TLS errors

Stalwart shares TLS certificates from Caddy via a mounted volume. If certificates are not available:

```bash
# Check if Caddy has certificates
docker exec mymail-caddy ls -la /data/caddy/certificates/

# Check the certificate path Stalwart expects
docker exec mymail-stalwart ls -la /caddy-data/caddy/certificates/
```

If certificates are missing, Stalwart falls back to its own ACME configuration. Check:

```bash
docker compose logs stalwart | grep -i "tls\|cert\|acme"
```

### Email client reports certificate mismatch

The client is connecting to a hostname that does not match the TLS certificate. Ensure your email client is configured to connect to `mail.example.com` (your `HOSTNAME`), not `example.com` or the server IP.

---

## DNS Propagation Issues

### Records not resolving after adding them

1. **Wait:** DNS propagation takes 5 minutes to 48 hours depending on the provider and record type.

2. **Check against authoritative nameservers:**
   ```bash
   # Find your authoritative nameservers
   dig NS example.com +short

   # Query the authoritative server directly
   dig A mail.example.com @ns1.example.com +short
   ```

3. **Flush local DNS cache:**
   ```bash
   # Linux (systemd-resolved)
   sudo systemd-resolve --flush-caches

   # macOS
   sudo dscacheutil -flushcache
   sudo killall -HUP mDNSResponder
   ```

4. **Check with external services:**
   - [whatsmydns.net](https://www.whatsmydns.net/) for global propagation status
   - [dns.google](https://dns.google/) for Google's DNS view

### DKIM record not found despite being added

DKIM records can be long (especially RSA). Check:

1. Is the record published at the correct name? It should be `mail._domainkey.example.com`, not `mail._domainkey`.
2. Did your DNS provider truncate the value? Check the raw value in your provider's dashboard.
3. Some providers require splitting long TXT records into quoted strings.

---

## Port Blocking

### Diagnosing blocked ports

```bash
# Check all required ports from the server
for port in 25 80 443 465 587 993 4190; do
    ss -tlnp | grep ":$port " >/dev/null 2>&1 && echo "Port $port: LISTENING" || echo "Port $port: NOT LISTENING"
done
```

From a different machine, test external connectivity:

```bash
# Test from another server or use an online port checker
nc -z -w5 YOUR_SERVER_IP 25 && echo "OK" || echo "BLOCKED"
nc -z -w5 YOUR_SERVER_IP 465 && echo "OK" || echo "BLOCKED"
nc -z -w5 YOUR_SERVER_IP 587 && echo "OK" || echo "BLOCKED"
nc -z -w5 YOUR_SERVER_IP 993 && echo "OK" || echo "BLOCKED"
```

### Firewall rules

```bash
# Check ufw status
ufw status verbose

# Ensure all required ports are allowed
ufw allow 25/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw allow 465/tcp
ufw allow 587/tcp
ufw allow 993/tcp
ufw allow 4190/tcp
```

### Cloud provider firewall

Some providers have an additional firewall layer outside the OS:

- **Hetzner:** Check the Firewall section in the Cloud Console
- **DigitalOcean:** Check Cloud Firewalls in Networking
- **Vultr:** Check the Firewall section
- **AWS/GCP:** Check Security Groups / Firewall Rules

---

## Rspamd Issues

### Rspamd is too aggressive (legitimate mail marked as spam)

Check the current thresholds in `rspamd/local.d/actions.conf`:

```bash
# Current settings
cat rspamd/local.d/actions.conf
```

Default thresholds:
- Greylist: 4
- Add header (mark as spam): 6
- Reject: 15

To make Rspamd less aggressive, increase the thresholds:

```
reject = 20;
add_header = 8;
greylist = 5;
```

Restart Rspamd:

```bash
docker compose restart rspamd
```

### Rspamd is not filtering spam

Check if Rspamd is connected to Redis (required for Bayes learning):

```bash
docker compose logs rspamd | grep -i "redis\|connect"
```

Check if the milter connection from Stalwart to Rspamd is working:

```bash
docker compose logs stalwart | grep -i "milter\|rspamd"
```

### Training the Bayesian filter

Rspamd auto-learns from messages that score very high (spam) or very low (ham). You can also train it manually by moving messages to/from the Spam folder in your email client. Stalwart communicates these actions to Rspamd.

### Viewing Rspamd statistics

```bash
docker exec mymail-rspamd rspamadm stat
```

---

## Disk Space Issues

### Check current usage

```bash
# System disk usage
df -h

# Docker disk usage
docker system df

# Volume sizes
docker system df -v | grep mymail
```

### Clean up Docker resources

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (be careful - only removes truly unused volumes)
docker volume prune

# Remove build cache
docker builder prune

# Full cleanup (removes all unused resources)
docker system prune -a
```

### Mail data growing too large

If the Stalwart data volume is large:

1. Check for user mailboxes with excessive mail:
   ```bash
   docker exec mymail-stalwart du -sh /opt/stalwart-mail/data/blobs/
   ```

2. Consider setting mailbox quotas through the admin dashboard.

3. Check that old messages in trash and spam folders are being auto-purged.

---

## Performance Issues

### High CPU usage

```bash
# Check per-container resource usage
docker stats --no-stream

# Check system load
top -bn1 | head -20
```

If Rspamd is using excessive CPU, it may be processing a spam flood. Check:
```bash
docker compose logs --tail=100 rspamd | grep -i "reject\|spam"
```

### High memory usage

```bash
# Check memory per container
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

Each container has memory limits defined in `docker-compose.yml`. If a container is hitting its limit, it may be killed and restarted by Docker.

### Slow email delivery

1. Check the Stalwart queue:
   ```bash
   docker compose logs stalwart | grep -i "queue\|retry\|defer"
   ```

2. Check DNS resolution from inside the container:
   ```bash
   docker exec mymail-stalwart sh -c "nslookup gmail.com"
   ```

3. If using a relay, check the relay service's status page for outages.

---

## Log Locations

| Log | Location | Command |
|---|---|---|
| Stalwart (mail server) | Container stdout + `/opt/stalwart-mail/logs/` | `docker compose logs stalwart` |
| Rspamd (spam filter) | Container stdout | `docker compose logs rspamd` |
| Caddy (reverse proxy) | Container stdout + `/data/logs/` | `docker compose logs caddy` |
| Redis | Container stdout | `docker compose logs redis` |
| Roundcube (webmail) | Container stdout | `docker compose logs roundcube` |
| Admin UI | Container stdout | `docker compose logs admin-ui` |
| Backup | `logs/backup.log` | `cat logs/backup.log` |

**Useful log commands:**

```bash
# Follow all logs in real time
docker compose logs -f

# Follow a specific service
docker compose logs -f stalwart

# Show last 100 lines
docker compose logs --tail=100 stalwart

# Filter for errors
docker compose logs stalwart 2>&1 | grep -i error

# Logs since a specific time
docker compose logs --since="2025-01-15T10:00:00" stalwart
```

---

## Getting Help

If the above steps do not resolve your issue:

1. **Check the GitHub Issues** for known problems and solutions
2. **Open a new GitHub Issue** with:
   - The output of `docker compose ps`
   - The output of `./scripts/health-check.sh`
   - Relevant log output (redact any passwords or personal information)
   - Your OS version and Docker version
3. **Community forums:** Search Stalwart, Rspamd, and Caddy community forums for service-specific issues
