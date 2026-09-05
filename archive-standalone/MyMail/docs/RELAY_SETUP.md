# Outbound Relay Setup Guide

An outbound SMTP relay routes your server's outgoing email through a trusted third-party service. This is strongly recommended for new mail servers because fresh IP addresses typically have no email reputation, which causes many receiving servers to reject or spam-flag your messages.

---

## Table of Contents

- [Why Use a Relay](#why-use-a-relay)
- [Amazon SES (Recommended)](#amazon-ses-recommended)
- [SendGrid](#sendgrid)
- [Mailgun](#mailgun)
- [Postmark](#postmark)
- [Verifying Relay Configuration](#verifying-relay-configuration)
- [Disabling the Relay](#disabling-the-relay)
- [Troubleshooting](#troubleshooting)

---

## Why Use a Relay

When you send email directly from a new VPS:

1. **Your IP has no reputation.** Major providers (Gmail, Outlook) are suspicious of unknown IPs.
2. **Some ISPs block port 25.** Residential ISPs and some cloud providers block outbound SMTP.
3. **IP blacklists.** Your VPS IP may have been previously used for spam.

A relay service:
- Sends from their high-reputation IP pool
- Handles bounce processing and feedback loops
- Provides delivery analytics and logs
- Costs fractions of a cent per email ($0.10 per 1,000 messages on SES)

**You still receive email directly** -- the relay only affects outbound delivery.

---

## Amazon SES (Recommended)

Amazon Simple Email Service (SES) is the most cost-effective relay at $0.10 per 1,000 emails with no monthly minimum.

### Step 1: Create an AWS Account

If you do not have one, sign up at [aws.amazon.com](https://aws.amazon.com). SES has a free tier of 3,000 messages per month for the first 12 months.

### Step 2: Choose a Region

SES is available in multiple regions. Choose one close to your server:

| Region | Endpoint |
|---|---|
| US East (N. Virginia) | `email-smtp.us-east-1.amazonaws.com` |
| US East (Ohio) | `email-smtp.us-east-2.amazonaws.com` |
| US West (Oregon) | `email-smtp.us-west-2.amazonaws.com` |
| EU (Ireland) | `email-smtp.eu-west-1.amazonaws.com` |
| EU (Frankfurt) | `email-smtp.eu-central-1.amazonaws.com` |
| Asia Pacific (Mumbai) | `email-smtp.ap-south-1.amazonaws.com` |

### Step 3: Verify Your Domain

1. Open the [SES console](https://console.aws.amazon.com/ses/)
2. Select your region from the dropdown
3. Go to **Verified identities** in the left sidebar
4. Click **Create identity**
5. Select **Domain** and enter your domain (e.g., `example.com`)
6. Click **Create identity**
7. SES will display DNS records to add:
   - Three CNAME records for DKIM verification
   - Optionally a TXT record for domain verification
8. Add these records to your DNS provider
9. Wait for the status to change to **Verified** (usually 5-15 minutes)

### Step 4: Request Production Access

New SES accounts are in **sandbox mode**, which limits sending to verified addresses only.

1. In the SES console, go to **Account dashboard**
2. Click **Request production access**
3. Fill out the form:
   - **Mail type:** Transactional (for personal email)
   - **Website URL:** Your domain
   - **Use case description:** Explain you are running a personal email server
4. AWS typically approves within 24 hours

### Step 5: Create SMTP Credentials

1. In the SES console, go to **SMTP settings**
2. Click **Create SMTP credentials**
3. Enter a name for the IAM user (e.g., `mymail-smtp`)
4. Click **Create user**
5. **Save the credentials immediately** -- the secret is shown only once:
   - SMTP username (starts with `AKIA...`)
   - SMTP password (long string)

### Step 6: Configure MyMail

Edit your `.env` file:

```bash
RELAY_ENABLED=true
RELAY_HOST=email-smtp.us-east-1.amazonaws.com
RELAY_PORT=587
RELAY_USER=AKIAIOSFODNN7EXAMPLE
RELAY_PASSWORD=BMXhpYklnGRjP3RQnFljVbMFgikRQ9kBfEXAMPLE
RELAY_STARTTLS=true
```

### Step 7: Update SPF Record

Add `include:amazonses.com` to your SPF record:

```
v=spf1 mx a:mail.example.com include:amazonses.com ~all
```

### Step 8: Restart Stalwart

```bash
docker compose restart stalwart
```

### Step 9: Send a Test Email

Send a test email from webmail and verify it arrives. Check the email headers -- you should see `amazonses.com` in the `Received` headers.

---

## SendGrid

SendGrid offers 100 free emails per day on their free tier.

### Step 1: Create an Account

Sign up at [sendgrid.com](https://sendgrid.com). Complete email verification and account setup.

### Step 2: Authenticate Your Domain

1. Go to **Settings > Sender Authentication**
2. Click **Authenticate Your Domain**
3. Select your DNS provider and enter your domain
4. SendGrid will display DNS records (CNAME records) to add
5. Add the records and click **Verify**

### Step 3: Create an API Key

1. Go to **Settings > API Keys**
2. Click **Create API Key**
3. Name it (e.g., `mymail-relay`)
4. Select **Restricted Access** and enable only **Mail Send**
5. Click **Create & View**
6. Copy the API key (starts with `SG.`)

### Step 4: Configure MyMail

Edit your `.env` file:

```bash
RELAY_ENABLED=true
RELAY_HOST=smtp.sendgrid.net
RELAY_PORT=587
RELAY_USER=apikey
RELAY_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
RELAY_STARTTLS=true
```

**Note:** The SMTP username for SendGrid is literally the string `apikey` (not your account email).

### Step 5: Update SPF Record

```
v=spf1 mx a:mail.example.com include:sendgrid.net ~all
```

### Step 6: Restart and Test

```bash
docker compose restart stalwart
```

Send a test email and verify delivery.

---

## Mailgun

Mailgun provides 1,000 free emails per month on the Flex plan (credit card required).

### Step 1: Create an Account

Sign up at [mailgun.com](https://www.mailgun.com) and verify your account.

### Step 2: Add Your Domain

1. Go to **Sending > Domains**
2. Click **Add New Domain**
3. Enter your domain (e.g., `example.com`)
4. Select your region (US or EU)
5. Add the displayed DNS records (TXT, MX, CNAME)
6. Click **Verify DNS settings**

### Step 3: Get SMTP Credentials

1. Go to **Sending > Domains > your domain > SMTP credentials**
2. Your default SMTP login is `postmaster@example.com`
3. Click **Reset Password** to generate an SMTP password
4. Copy the credentials

### Step 4: Configure MyMail

```bash
RELAY_ENABLED=true
RELAY_HOST=smtp.mailgun.org
RELAY_PORT=587
RELAY_USER=postmaster@example.com
RELAY_PASSWORD=your-mailgun-smtp-password
RELAY_STARTTLS=true
```

For EU region, use `smtp.eu.mailgun.org` instead.

### Step 5: Update SPF Record

```
v=spf1 mx a:mail.example.com include:mailgun.org ~all
```

### Step 6: Restart and Test

```bash
docker compose restart stalwart
```

---

## Postmark

Postmark focuses on transactional email with excellent deliverability. Pricing starts at $15/month for 10,000 emails.

### Step 1: Create an Account

Sign up at [postmarkapp.com](https://postmarkapp.com). Postmark requires account approval, which may take 1-2 business days.

### Step 2: Create a Server and Sender

1. Create a new **Server** in Postmark
2. Go to **Sender Signatures** and add your domain
3. Verify domain ownership by adding the displayed DNS records

### Step 3: Get SMTP Credentials

1. Go to **Server > Credentials**
2. Your SMTP credentials are:
   - Username: Your Server API Token
   - Password: Your Server API Token (same value)

### Step 4: Configure MyMail

```bash
RELAY_ENABLED=true
RELAY_HOST=smtp.postmarkapp.com
RELAY_PORT=587
RELAY_USER=your-server-api-token
RELAY_PASSWORD=your-server-api-token
RELAY_STARTTLS=true
```

### Step 5: Update SPF Record

```
v=spf1 mx a:mail.example.com include:spf.mtasv.net ~all
```

### Step 6: Restart and Test

```bash
docker compose restart stalwart
```

---

## Verifying Relay Configuration

After configuring your relay, verify it is working:

### 1. Check Stalwart Logs

```bash
docker compose logs -f stalwart | grep -i relay
```

Look for successful connection messages to the relay host.

### 2. Send a Test Email

Send an email from your webmail to a Gmail or Outlook account. Check the full email headers at the destination -- you should see the relay service in the routing path.

### 3. Check Delivery Reports

- **SES:** SES console > Sending statistics
- **SendGrid:** Activity > Email Activity
- **Mailgun:** Sending > Logs
- **Postmark:** Activity > Messages

### 4. Test Email Score

Send a message to [mail-tester.com](https://www.mail-tester.com/) and check your score. A properly configured relay with correct DNS records should score 9/10 or higher.

---

## Disabling the Relay

To send email directly from your server without a relay:

```bash
RELAY_ENABLED=false
```

Then restart:

```bash
docker compose restart stalwart
```

**Before disabling the relay**, ensure:
- Your server IP is not on any blacklists (check with `./scripts/health-check.sh`)
- Your PTR record is correctly configured
- Port 25 outbound is not blocked by your hosting provider
- Your IP has built up some sending reputation

---

## Troubleshooting

**Problem: Emails are not being sent at all**

1. Check Stalwart logs: `docker compose logs stalwart | grep -i error`
2. Verify relay credentials in `.env` are correct
3. Test connectivity to the relay:
   ```bash
   docker exec mymail-stalwart sh -c "nc -z -w5 email-smtp.us-east-1.amazonaws.com 587 && echo OK || echo FAIL"
   ```

**Problem: Relay rejects authentication**

- SES: Verify you are using SMTP credentials (not IAM credentials). SMTP credentials are generated separately in the SES console.
- SendGrid: The username must be literally `apikey` (not your email).
- Check that `RELAY_STARTTLS` matches the port (`true` for 587, `false` for 465).

**Problem: Relay returns "Email address is not verified"**

- SES sandbox mode: You can only send to verified email addresses until you request production access.
- SES: Verify your domain in the SES console under "Verified identities."

**Problem: SPF failures after enabling relay**

- You must add the relay provider's SPF include to your domain's SPF record.
- You can only have one SPF TXT record per domain. Merge all includes into a single record.

**Problem: Emails are delayed**

- Check the Stalwart queue: `docker compose logs stalwart | grep -i queue`
- SES has sending rate limits. New accounts start at 1 email per second. Request a rate increase through the SES console.
