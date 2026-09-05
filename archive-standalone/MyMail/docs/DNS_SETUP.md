# DNS Setup Guide

Correct DNS configuration is critical for email delivery. Missing or incorrect records will cause your emails to be rejected or marked as spam. This guide covers every required DNS record and provides step-by-step instructions for common DNS providers.

---

## Table of Contents

- [Required DNS Records Overview](#required-dns-records-overview)
- [Record Details](#record-details)
  - [A Records](#a-records)
  - [MX Record](#mx-record)
  - [SPF Record](#spf-record)
  - [DKIM Records](#dkim-records)
  - [DMARC Record](#dmarc-record)
  - [PTR Record (Reverse DNS)](#ptr-record-reverse-dns)
  - [Autodiscover SRV Records (Optional)](#autodiscover-srv-records-optional)
- [Provider-Specific Guides](#provider-specific-guides)
  - [Cloudflare](#cloudflare)
  - [Namecheap](#namecheap)
  - [GoDaddy](#godaddy)
- [Verifying DNS Records](#verifying-dns-records)
- [DNS Propagation](#dns-propagation)
- [Troubleshooting DNS Issues](#troubleshooting-dns-issues)

---

## Required DNS Records Overview

Replace `example.com` with your domain and `203.0.113.50` with your server IP throughout.

| # | Type | Name | Value | Required |
|---|---|---|---|---|
| 1 | A | `mail.example.com` | `203.0.113.50` | Yes |
| 2 | A | `admin.example.com` | `203.0.113.50` | Yes |
| 3 | A | `jmap.example.com` | `203.0.113.50` | Yes |
| 4 | MX | `example.com` | `10 mail.example.com.` | Yes |
| 5 | TXT | `example.com` | `v=spf1 mx a:mail.example.com ~all` | Yes |
| 6 | TXT | `mail._domainkey.example.com` | `v=DKIM1; k=ed25519; p=...` | Yes |
| 7 | TXT | `mail-rsa._domainkey.example.com` | `v=DKIM1; k=rsa; p=...` | Recommended |
| 8 | TXT | `_dmarc.example.com` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ...` | Yes |
| 9 | PTR | `203.0.113.50` | `mail.example.com` | Yes |
| 10 | SRV | `_submission._tcp.example.com` | `0 1 587 mail.example.com.` | Optional |
| 11 | SRV | `_imaps._tcp.example.com` | `0 1 993 mail.example.com.` | Optional |

---

## Record Details

### A Records

A records map hostnames to your server IP address.

**mail.example.com** (required):

```
Type:  A
Name:  mail
Value: 203.0.113.50
TTL:   3600 (1 hour)
```

**admin.example.com** (required for admin panel):

```
Type:  A
Name:  admin
Value: 203.0.113.50
TTL:   3600
```

**jmap.example.com** (required for JMAP API and autodiscover):

```
Type:  A
Name:  jmap
Value: 203.0.113.50
TTL:   3600
```

### MX Record

The MX record tells other mail servers where to deliver email for your domain.

```
Type:     MX
Name:     @ (or example.com)
Value:    mail.example.com.
Priority: 10
TTL:      3600
```

**Notes:**
- The priority (10) determines preference when multiple MX records exist. Lower numbers have higher priority.
- The trailing dot after the hostname is required in standard DNS notation, but some providers add it automatically.

### SPF Record

SPF (Sender Policy Framework) specifies which servers are authorized to send email for your domain.

```
Type:  TXT
Name:  @ (or example.com)
Value: v=spf1 mx a:mail.example.com ~all
TTL:   3600
```

**SPF breakdown:**
- `v=spf1` -- Identifies this as an SPF record
- `mx` -- Authorizes the server(s) listed in MX records
- `a:mail.example.com` -- Authorizes the specific mail server hostname
- `~all` -- Soft fail for unauthorized senders (recommended initially)

**If using an outbound relay**, you must include the relay provider in your SPF record:

| Relay Provider | SPF Include |
|---|---|
| Amazon SES | `include:amazonses.com` |
| SendGrid | `include:sendgrid.net` |
| Mailgun | `include:mailgun.org` |
| Postmark | `include:spf.mtasv.net` |

**Example with Amazon SES:**

```
v=spf1 mx a:mail.example.com include:amazonses.com ~all
```

**Upgrading to strict enforcement:** Once you have confirmed your email is working correctly, change `~all` (soft fail) to `-all` (hard fail) for stronger protection:

```
v=spf1 mx a:mail.example.com include:amazonses.com -all
```

### DKIM Records

DKIM (DomainKeys Identified Mail) signs outgoing messages so recipients can verify they were not tampered with. MyMail generates two DKIM keys during setup.

**Ed25519 DKIM (primary):**

```
Type:  TXT
Name:  mail._domainkey
Value: v=DKIM1; k=ed25519; p=YOUR_ED25519_PUBLIC_KEY
TTL:   3600
```

**RSA DKIM (compatibility fallback):**

```
Type:  TXT
Name:  mail-rsa._domainkey
Value: v=DKIM1; k=rsa; p=YOUR_RSA_PUBLIC_KEY
TTL:   3600
```

The public key values are displayed by `setup.sh` during initial configuration. You can also retrieve them from the key files:

```bash
# Ed25519 public key
grep -v '^-' stalwart/config/dkim/public.key | tr -d '\n'

# RSA public key
grep -v '^-' stalwart/config/dkim/rsa-public.key | tr -d '\n'
```

**Notes:**
- The RSA DKIM record can be very long (>255 characters). Some DNS providers require splitting it into multiple strings. See the provider-specific guides below.
- Ed25519 is the modern standard with shorter keys. RSA provides backward compatibility.

### DMARC Record

DMARC (Domain-based Message Authentication, Reporting, and Conformance) tells receiving servers what to do with messages that fail SPF and DKIM checks.

```
Type:  TXT
Name:  _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; fo=1
TTL:   3600
```

**DMARC breakdown:**
- `v=DMARC1` -- Identifies this as a DMARC record
- `p=quarantine` -- Policy: quarantine (send to spam) messages that fail. Other options:
  - `p=none` -- Monitor only (good for initial testing)
  - `p=reject` -- Reject outright (strictest, use after confirming everything works)
- `rua=mailto:dmarc@example.com` -- Address for aggregate (daily summary) reports
- `ruf=mailto:dmarc@example.com` -- Address for forensic (per-failure) reports
- `fo=1` -- Generate failure reports when either SPF or DKIM fails

**Recommended progression:**
1. Start with `p=none` while testing
2. Move to `p=quarantine` once delivery is confirmed
3. Upgrade to `p=reject` after running successfully for a few weeks

### PTR Record (Reverse DNS)

The PTR record maps your IP address back to your mail hostname. Many receiving mail servers check this and will reject or spam-flag messages when the PTR does not match.

**This is not configured in your DNS provider.** It is configured through your VPS hosting provider's control panel.

| Provider | Where to Set PTR |
|---|---|
| **Hetzner** | Cloud Console > Networking > Primary IPs > Click the IP > Edit Reverse DNS |
| **DigitalOcean** | Rename your droplet to `mail.example.com` (PTR is auto-set from droplet name) |
| **Vultr** | Server Settings > IPv4 > Reverse DNS > Set to `mail.example.com` |

**PTR value:** `mail.example.com` (must exactly match `HOSTNAME` in your `.env`).

### Autodiscover SRV Records (Optional)

SRV records help email clients automatically discover server settings. These are optional but improve the setup experience for users.

**SMTP Submission:**

```
Type:     SRV
Name:     _submission._tcp
Priority: 0
Weight:   1
Port:     587
Target:   mail.example.com.
TTL:      3600
```

**IMAPS:**

```
Type:     SRV
Name:     _imaps._tcp
Priority: 0
Weight:   1
Port:     993
Target:   mail.example.com.
TTL:      3600
```

---

## Provider-Specific Guides

### Cloudflare

**Important:** For the mail hostname (`mail.example.com`), the Cloudflare proxy (orange cloud) **must be disabled**. SMTP, IMAP, and other mail protocols do not work through Cloudflare's HTTP proxy.

1. Log into [dash.cloudflare.com](https://dash.cloudflare.com) and select your domain
2. Go to **DNS > Records**
3. Click **Add Record** for each record below

**A Records:**

| Type | Name | Content | Proxy Status |
|---|---|---|---|
| A | `mail` | `203.0.113.50` | **DNS only** (grey cloud) |
| A | `admin` | `203.0.113.50` | Proxied (orange cloud) is OK |
| A | `jmap` | `203.0.113.50` | Proxied (orange cloud) is OK |

**MX Record:**

| Type | Name | Mail server | Priority |
|---|---|---|---|
| MX | `@` | `mail.example.com` | 10 |

**TXT Records:**

For the SPF record:
- Type: TXT
- Name: `@`
- Content: `v=spf1 mx a:mail.example.com ~all`

For the DKIM Ed25519 record:
- Type: TXT
- Name: `mail._domainkey`
- Content: `v=DKIM1; k=ed25519; p=YOUR_ED25519_PUBLIC_KEY`

For the DKIM RSA record (Cloudflare supports long TXT records natively):
- Type: TXT
- Name: `mail-rsa._domainkey`
- Content: `v=DKIM1; k=rsa; p=YOUR_RSA_PUBLIC_KEY`

For the DMARC record:
- Type: TXT
- Name: `_dmarc`
- Content: `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; fo=1`

**SRV Records (optional):**

Click Add Record > SRV:
- Name: `_submission._tcp`, Priority: 0, Weight: 1, Port: 587, Target: `mail.example.com`
- Name: `_imaps._tcp`, Priority: 0, Weight: 1, Port: 993, Target: `mail.example.com`

### Namecheap

1. Log into [namecheap.com](https://www.namecheap.com) and go to **Domain List**
2. Click **Manage** next to your domain
3. Go to the **Advanced DNS** tab
4. Add each record under **Host Records**

**A Records:**

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `mail` | `203.0.113.50` | Automatic |
| A Record | `admin` | `203.0.113.50` | Automatic |
| A Record | `jmap` | `203.0.113.50` | Automatic |

**MX Record:**

| Type | Host | Value | Priority | TTL |
|---|---|---|---|---|
| MX Record | `@` | `mail.example.com.` | 10 | Automatic |

**TXT Records:**

| Type | Host | Value | TTL |
|---|---|---|---|
| TXT Record | `@` | `v=spf1 mx a:mail.example.com ~all` | Automatic |
| TXT Record | `mail._domainkey` | `v=DKIM1; k=ed25519; p=...` | Automatic |
| TXT Record | `mail-rsa._domainkey` | `v=DKIM1; k=rsa; p=...` | Automatic |
| TXT Record | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; fo=1` | Automatic |

**Note on long TXT records:** Namecheap has a 2048-character limit per TXT record. If your RSA DKIM key exceeds this, you may need to contact Namecheap support or use their API.

### GoDaddy

1. Log into [godaddy.com](https://www.godaddy.com) and go to **My Products**
2. Click **DNS** next to your domain
3. Click **Add** under **DNS Records**

**A Records:**

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `mail` | `203.0.113.50` | 1 Hour |
| A | `admin` | `203.0.113.50` | 1 Hour |
| A | `jmap` | `203.0.113.50` | 1 Hour |

**MX Record:**

| Type | Name | Value | Priority | TTL |
|---|---|---|---|---|
| MX | `@` | `mail.example.com` | 10 | 1 Hour |

**TXT Records:**

| Type | Name | Value | TTL |
|---|---|---|---|
| TXT | `@` | `v=spf1 mx a:mail.example.com ~all` | 1 Hour |
| TXT | `mail._domainkey` | `v=DKIM1; k=ed25519; p=...` | 1 Hour |
| TXT | `mail-rsa._domainkey` | `v=DKIM1; k=rsa; p=...` | 1 Hour |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; fo=1` | 1 Hour |

**Note on long TXT records:** GoDaddy supports TXT records up to 1024 characters in the web UI. For the RSA DKIM key, you may need to use the GoDaddy API or split the value into quoted strings:

```
"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCg..." "KAABCDEFabcdef..."
```

---

## Verifying DNS Records

### Using the Built-in Validator

```bash
./scripts/dns-validate.sh
```

This script checks all required records and reports pass/fail for each.

### Using Command-Line Tools

```bash
# Check A record
dig A mail.example.com +short

# Check MX record
dig MX example.com +short

# Check SPF record
dig TXT example.com +short | grep spf

# Check DKIM records
dig TXT mail._domainkey.example.com +short
dig TXT mail-rsa._domainkey.example.com +short

# Check DMARC record
dig TXT _dmarc.example.com +short

# Check PTR (reverse DNS)
dig -x 203.0.113.50 +short
```

### Using Online Tools

- [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) -- Comprehensive email DNS checker
- [Mail-Tester](https://www.mail-tester.com/) -- Send a test email and get a deliverability score
- [DKIM Core Key Check](https://dkimcore.org/tools/) -- Validate DKIM record
- [Google Admin Toolbox](https://toolbox.googleapps.com/apps/checkmx/) -- Check MX configuration

---

## DNS Propagation

DNS changes do not take effect instantly. Propagation times depend on:

| Factor | Typical Time |
|---|---|
| New records (no cache) | 5-15 minutes |
| Updated records | Up to the old TTL value |
| Global propagation | 1-48 hours |

**Tips:**
- Set a low TTL (300 seconds / 5 minutes) before making changes, then increase it after verification.
- Use [whatsmydns.net](https://www.whatsmydns.net/) to check propagation globally.
- Flush your local DNS cache if you are testing from your own machine:
  - **macOS:** `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
  - **Linux:** `sudo systemd-resolve --flush-caches`
  - **Windows:** `ipconfig /flushdns`

---

## Troubleshooting DNS Issues

**Problem: `dig` shows no results for a record you just added**

- Wait 5-15 minutes for propagation
- Verify you added the record to the correct domain/zone
- Check for typos in the record name (e.g., `mail._domainkey` not `mail._domainKey`)
- Try querying a specific nameserver: `dig TXT example.com @8.8.8.8`

**Problem: DKIM record shows as empty or truncated**

- RSA DKIM keys are long. Verify your DNS provider supports TXT records of that length.
- Some providers require the value to be split into 255-character quoted strings
- Try the Ed25519 DKIM first (much shorter key)

**Problem: SPF record lookup failures**

- You can only have one SPF TXT record per domain. If you have multiple, merge them.
- SPF allows a maximum of 10 DNS lookups. Each `include:` counts as one lookup.

**Problem: PTR record does not match**

- PTR is set through your VPS provider, not your domain registrar
- Changes can take 15-60 minutes to propagate
- Verify with: `dig -x YOUR_SERVER_IP +short`

**Problem: MX record not resolving**

- Ensure the MX value ends with a dot in providers that require it (e.g., `mail.example.com.`)
- The MX target must have a valid A record
- Do not use an IP address as the MX value -- it must be a hostname
