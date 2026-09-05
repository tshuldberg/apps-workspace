# Quick Start Guide

This guide walks you through deploying MyMail from scratch on a fresh VPS. By the end, you will have a fully functional private email server with webmail access, spam filtering, and automatic TLS certificates.

**Time required:** 20-30 minutes (plus DNS propagation time).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: Provision a VPS](#step-1-provision-a-vps)
- [Step 2: Initial Server Setup](#step-2-initial-server-setup)
- [Step 3: Install Docker](#step-3-install-docker)
- [Step 4: Clone MyMail](#step-4-clone-mymail)
- [Step 5: Run the Setup Wizard](#step-5-run-the-setup-wizard)
- [Step 6: Configure DNS Records](#step-6-configure-dns-records)
- [Step 7: Start Services](#step-7-start-services)
- [Step 8: Verify the Deployment](#step-8-verify-the-deployment)
- [Step 9: Send a Test Email](#step-9-send-a-test-email)
- [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, you need:

| Requirement | Details |
|---|---|
| **A domain name** | Any registrar works (Cloudflare, Namecheap, GoDaddy, etc.) |
| **A VPS** | 2 GB+ RAM, 20 GB+ disk, running Ubuntu 22.04+ or Debian 12+ |
| **SSH access** | Terminal access to your VPS via SSH |
| **Port access** | Ports 25, 80, 443, 465, 587, 993 must not be blocked by your provider |

**Important:** Some cloud providers block port 25 by default (notably Oracle Cloud and some AWS Lightsail configurations). Verify with your provider before purchasing. Hetzner, DigitalOcean, and Vultr generally allow port 25 on new accounts.

---

## Step 1: Provision a VPS

Choose a provider and create a server:

### Hetzner (Recommended -- ~$4.50/month)

1. Sign up at [hetzner.com/cloud](https://www.hetzner.com/cloud)
2. Create a new project
3. Click **Add Server**
4. Select location: Ashburn (us-east), Falkenstein (eu-central), or Helsinki (eu-north)
5. Select image: **Ubuntu 24.04**
6. Select type: **CX22** (2 vCPU, 4 GB RAM, 40 GB disk)
7. Add your SSH key (or use password authentication)
8. Click **Create & Buy Now**
9. Note the public IPv4 address

### DigitalOcean ($6/month)

1. Sign up at [digitalocean.com](https://www.digitalocean.com)
2. Click **Create Droplet**
3. Select region: New York, San Francisco, or Amsterdam
4. Select image: **Ubuntu 24.04**
5. Select size: **Basic -- $6/month** (1 vCPU, 1 GB RAM, 25 GB disk)
   - For better performance, choose the $12/month plan (2 GB RAM)
6. Add your SSH key
7. Click **Create Droplet**

### Vultr ($6/month)

1. Sign up at [vultr.com](https://www.vultr.com)
2. Click **Deploy New Server**
3. Select **Cloud Compute -- Shared CPU**
4. Select location and **Ubuntu 24.04**
5. Select plan: **$6/month** (1 vCPU, 1 GB RAM, 25 GB SSD)
6. Add your SSH key
7. Click **Deploy Now**

---

## Step 2: Initial Server Setup

SSH into your new server:

```bash
ssh root@YOUR_SERVER_IP
```

Update the system and install essential packages:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw dnsutils
```

Configure the firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp    # HTTP (Caddy)
ufw allow 443/tcp   # HTTPS (Caddy)
ufw allow 443/udp   # HTTP/3 (Caddy)
ufw allow 25/tcp    # SMTP inbound
ufw allow 465/tcp   # SMTPS
ufw allow 587/tcp   # SMTP submission
ufw allow 993/tcp   # IMAPS
ufw allow 4190/tcp  # ManageSieve
ufw enable
```

Set a hostname for the server:

```bash
hostnamectl set-hostname mail.example.com
```

Replace `mail.example.com` with your actual mail hostname.

---

## Step 3: Install Docker

Install Docker Engine and Docker Compose v2:

```bash
curl -fsSL https://get.docker.com | sh
```

Add your user to the docker group (if not running as root):

```bash
sudo usermod -aG docker $USER
```

Log out and back in for the group change to take effect, then verify:

```bash
docker --version
docker compose version
```

You need Docker Engine 24+ and Compose v2.

---

## Step 4: Clone MyMail

Clone the repository and enter the directory:

```bash
git clone https://github.com/yourusername/mymail.git
cd mymail
```

Make the scripts executable:

```bash
chmod +x scripts/*.sh
```

---

## Step 5: Run the Setup Wizard

Run the interactive setup script:

```bash
./scripts/setup.sh
```

The wizard will:

1. **Check prerequisites** -- Verifies Docker, Docker Compose, and OpenSSL are installed
2. **Prompt for configuration** -- Asks for:
   - Your domain name (e.g., `example.com`)
   - Mail hostname (defaults to `mail.example.com`)
   - Server public IP (auto-detected)
   - Admin email address (defaults to `admin@example.com`)
3. **Generate credentials** -- Creates a secure admin password and Restic backup password
4. **Generate DKIM keys** -- Creates both Ed25519 and RSA-2048 keys for email signing
5. **Display DNS records** -- Shows every DNS record you need to add

**Save the admin password** displayed during setup. It is written to `.env` but only shown on screen once.

Example setup output:

```
Enter your domain (e.g., example.com): example.com
Mail hostname [mail.example.com]:
Server public IP [203.0.113.50]:
Admin email [admin@example.com]:
[OK]  Generated admin password (saved to .env)
      Admin password: xK9mP2vR7nQ4wL5j
      Save this securely - it won't be shown again.
```

---

## Step 6: Configure DNS Records

After the setup wizard displays the required DNS records, add them to your domain's DNS provider. You need to create the following records:

| Record Type | Name | Value |
|---|---|---|
| A | `mail.example.com` | `YOUR_SERVER_IP` |
| A | `admin.example.com` | `YOUR_SERVER_IP` |
| A | `jmap.example.com` | `YOUR_SERVER_IP` |
| MX | `example.com` | `10 mail.example.com.` |
| TXT | `example.com` | `v=spf1 mx a:mail.example.com ~all` |
| TXT | `mail._domainkey.example.com` | `v=DKIM1; k=ed25519; p=YOUR_ED25519_PUBLIC_KEY` |
| TXT | `mail-rsa._domainkey.example.com` | `v=DKIM1; k=rsa; p=YOUR_RSA_PUBLIC_KEY` |
| TXT | `_dmarc.example.com` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; fo=1` |

Additionally, set a **PTR (reverse DNS) record** through your VPS provider's control panel:

- **Hetzner:** Networking > Primary IPs > click the IP > edit Reverse DNS
- **DigitalOcean:** Already set to the droplet name; rename the droplet to `mail.example.com`
- **Vultr:** Settings > IPv4 > Reverse DNS > set to `mail.example.com`

For detailed provider-specific instructions, see [DNS_SETUP.md](DNS_SETUP.md).

**DNS propagation** typically takes 5-30 minutes, but can take up to 48 hours. You can check propagation with:

```bash
dig A mail.example.com +short
dig MX example.com +short
dig TXT example.com +short
```

---

## Step 7: Start Services

When the setup wizard asks to start services, press `Y`:

```
Proceed with starting services? [Y/n]: Y
```

Or start them manually:

```bash
docker compose up -d
```

The first startup will:

1. Pull Docker images (Caddy, Stalwart, Rspamd, Redis, Roundcube)
2. Build the Admin UI image from source
3. Start all containers
4. Obtain TLS certificates from Let's Encrypt via Caddy
5. Wait for health checks to pass

This takes 1-3 minutes. Monitor progress with:

```bash
docker compose ps
docker compose logs -f
```

All containers should show `healthy` status:

```
NAME               STATUS                 PORTS
mymail-caddy       Up 2 minutes (healthy) 0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
mymail-stalwart    Up 2 minutes (healthy) 0.0.0.0:25->25/tcp, 0.0.0.0:465->465/tcp, ...
mymail-rspamd      Up 2 minutes (healthy)
mymail-redis       Up 2 minutes (healthy)
mymail-roundcube   Up 2 minutes (healthy)
mymail-admin       Up 2 minutes (healthy)
```

---

## Step 8: Verify the Deployment

### Run the Health Check

```bash
./scripts/health-check.sh
```

This checks:
- All Docker containers are running and healthy
- All ports (25, 80, 443, 465, 587, 993, 4190) are open
- HTTPS is responding for webmail and admin panel
- DNS records (MX, A, SPF, DKIM, DMARC) are configured
- Your IP is not on any email blacklists

### Run the DNS Validator

```bash
./scripts/dns-validate.sh
```

This performs a detailed check of every DNS record with pass/fail reporting.

### Access the Web Interfaces

- **Webmail:** `https://mail.example.com` -- Log in with your admin email and password
- **Admin Panel:** `https://admin.example.com` -- Manage accounts, domains, and settings

---

## Step 9: Send a Test Email

1. Open Roundcube webmail at `https://mail.example.com`
2. Log in with your admin email (e.g., `admin@example.com`) and the generated password
3. Compose a new message to an external address (Gmail, Outlook, etc.)
4. Check that the email arrives in the inbox (not spam)
5. Reply to the test email to verify inbound delivery

If the email lands in spam, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) and consider setting up an outbound relay -- see [RELAY_SETUP.md](RELAY_SETUP.md).

---

## Next Steps

Your email server is now running. Here are the recommended next steps:

1. **Set up an outbound relay** for better deliverability -- [RELAY_SETUP.md](RELAY_SETUP.md)
2. **Configure backups** to protect your data -- [BACKUP_RESTORE.md](BACKUP_RESTORE.md)
3. **Set up email clients** on your phone and desktop -- [MOBILE_SETUP.md](MOBILE_SETUP.md)
4. **Harden security** with fail2ban and SSH keys -- [SECURITY.md](SECURITY.md)
5. **Migrate existing email** from Gmail or Outlook -- [MIGRATION.md](MIGRATION.md)
6. **Review the full configuration reference** -- [CONFIGURATION.md](CONFIGURATION.md)
