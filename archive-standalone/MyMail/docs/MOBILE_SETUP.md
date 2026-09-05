# Mobile and Desktop Client Setup Guide

MyMail works with any standard email client that supports IMAP and SMTP. This guide provides step-by-step setup instructions for the most popular clients.

---

## Table of Contents

- [Connection Settings](#connection-settings)
- [iOS Mail](#ios-mail)
- [Gmail App (Android)](#gmail-app-android)
- [Microsoft Outlook Mobile](#microsoft-outlook-mobile)
- [Mozilla Thunderbird (Desktop)](#mozilla-thunderbird-desktop)
- [Apple Mail (macOS)](#apple-mail-macos)
- [Other Clients](#other-clients)
- [Troubleshooting Client Issues](#troubleshooting-client-issues)

---

## Connection Settings

Use these settings for any email client. Replace `mail.example.com` with your actual `HOSTNAME` from `.env`.

### Incoming Mail (IMAP)

| Setting | Value |
|---|---|
| Protocol | IMAP |
| Server | `mail.example.com` |
| Port | 993 |
| Security | SSL/TLS |
| Authentication | Normal password |
| Username | Your full email address (e.g., `user@example.com`) |
| Password | Your account password |

### Outgoing Mail (SMTP)

| Setting | Value |
|---|---|
| Protocol | SMTP |
| Server | `mail.example.com` |
| Port | 465 (SSL/TLS) **or** 587 (STARTTLS) |
| Security | SSL/TLS (port 465) or STARTTLS (port 587) |
| Authentication | Normal password |
| Username | Your full email address (e.g., `user@example.com`) |
| Password | Your account password |

**Note:** The username is always your full email address, not just the part before `@`.

---

## iOS Mail

### Step 1: Open Settings

Open the **Settings** app on your iPhone or iPad.

### Step 2: Navigate to Mail Accounts

Tap **Mail** > **Accounts** > **Add Account** > **Other** > **Add Mail Account**.

### Step 3: Enter Account Information

| Field | Value |
|---|---|
| Name | Your display name (e.g., "John Doe") |
| Email | `user@example.com` |
| Password | Your account password |
| Description | MyMail (or any label you prefer) |

Tap **Next**.

### Step 4: Configure IMAP

iOS will try to auto-detect settings. If it asks you to choose, select **IMAP**.

**Incoming Mail Server:**

| Field | Value |
|---|---|
| Host Name | `mail.example.com` |
| User Name | `user@example.com` |
| Password | Your account password |

**Outgoing Mail Server:**

| Field | Value |
|---|---|
| Host Name | `mail.example.com` |
| User Name | `user@example.com` |
| Password | Your account password |

Tap **Next**.

### Step 5: Verify and Save

iOS will verify the connection. This may take a moment. If you see a "Cannot Verify Server Identity" warning, tap **Continue** (this can happen while TLS certificates propagate).

Tap **Save**.

### Step 6: Configure SSL Settings (if needed)

If the auto-configuration does not set the correct ports:

1. Go to **Settings** > **Mail** > **Accounts** > **MyMail**
2. Tap the account name at the top
3. Tap **SMTP** under Outgoing Mail Server
4. Tap the primary server (`mail.example.com`)
5. Verify:
   - **Use SSL:** On
   - **Server Port:** 465
   - **Authentication:** Password
6. Go back and tap **Advanced** at the bottom
7. Under **Incoming Settings**, verify:
   - **Use SSL:** On
   - **Server Port:** 993
   - **Authentication:** Password

---

## Gmail App (Android)

The Gmail app on Android can connect to non-Gmail IMAP accounts.

### Step 1: Open Gmail

Open the **Gmail** app and tap your profile icon in the top right corner.

### Step 2: Add Account

Tap **Add another account** > **Other**.

### Step 3: Enter Email Address

Enter your email address (e.g., `user@example.com`) and tap **Next**.

### Step 4: Select Account Type

Select **Personal (IMAP)**.

### Step 5: Enter Password

Enter your account password and tap **Next**.

### Step 6: Configure Incoming Server

| Field | Value |
|---|---|
| Username | `user@example.com` |
| Password | Your account password |
| Server | `mail.example.com` |
| Port | 993 |
| Security type | SSL/TLS |

Tap **Next**.

### Step 7: Configure Outgoing Server

| Field | Value |
|---|---|
| SMTP server | `mail.example.com` |
| Port | 465 |
| Security type | SSL/TLS |
| Require sign-in | Checked |
| Username | `user@example.com` |
| Password | Your account password |

Tap **Next**.

### Step 8: Account Options

Configure sync frequency, notifications, and other preferences as desired. Tap **Next**, then enter a display name and tap **Next** to complete setup.

---

## Microsoft Outlook Mobile

### Step 1: Open Outlook

Open the **Outlook** app on your phone (iOS or Android).

### Step 2: Add Account

If this is your first account, you will be prompted to enter an email. Otherwise, tap the hamburger menu > Settings (gear icon) > **Add Email Account**.

### Step 3: Choose Account Type

Enter your email address (e.g., `user@example.com`).

Outlook will try to auto-detect settings. If it asks, select **IMAP**.

### Step 4: Enter Server Settings

If Outlook cannot auto-detect, it will show advanced settings:

**IMAP Incoming Mail Server:**

| Field | Value |
|---|---|
| IMAP Host Name | `mail.example.com` |
| IMAP Port | 993 |
| Security Type | SSL/TLS |
| IMAP Username | `user@example.com` |
| IMAP Password | Your account password |

**SMTP Outgoing Mail Server:**

| Field | Value |
|---|---|
| SMTP Host Name | `mail.example.com` |
| SMTP Port | 465 |
| Security Type | SSL/TLS |
| SMTP Username | `user@example.com` |
| SMTP Password | Your account password |

Tap the checkmark to save.

### Step 5: Verify

Outlook will test the connection. Once verified, your inbox will begin syncing.

---

## Mozilla Thunderbird (Desktop)

Thunderbird has excellent auto-configuration support. If your server has the `autoconfig` feature enabled (it does by default in Stalwart), Thunderbird may detect settings automatically.

### Step 1: Open Thunderbird

Launch Thunderbird. If this is a new installation, the account setup wizard opens automatically. Otherwise, go to **Account Settings** > **Account Actions** > **Add Mail Account**.

### Step 2: Enter Account Details

| Field | Value |
|---|---|
| Your full name | Your display name |
| Email address | `user@example.com` |
| Password | Your account password |

Click **Configure manually** (or let auto-detection run first).

### Step 3: Manual Configuration

**Incoming:**

| Field | Value |
|---|---|
| Protocol | IMAP |
| Hostname | `mail.example.com` |
| Port | 993 |
| Connection security | SSL/TLS |
| Authentication method | Normal password |
| Username | `user@example.com` |

**Outgoing:**

| Field | Value |
|---|---|
| Hostname | `mail.example.com` |
| Port | 465 |
| Connection security | SSL/TLS |
| Authentication method | Normal password |
| Username | `user@example.com` |

Click **Re-test** to verify the settings, then click **Done**.

### Step 4: ManageSieve (Optional)

Thunderbird supports ManageSieve for server-side filtering. To enable it:

1. Go to **Tools** > **Add-ons and Themes**
2. Search for **Sieve** and install the "Sieve Message Filters" add-on
3. Go to **Account Settings** > **Sieve Message Filters**
4. Configure:
   - Server: `mail.example.com`
   - Port: 4190
   - Security: STARTTLS
   - Authentication: Use IMAP credentials

---

## Apple Mail (macOS)

### Step 1: Open Mail

Open the **Mail** app. If no accounts are configured, the setup wizard starts automatically. Otherwise, go to **Mail** > **Add Account** > **Other Mail Account**.

### Step 2: Enter Account Information

| Field | Value |
|---|---|
| Name | Your display name |
| Email Address | `user@example.com` |
| Password | Your account password |

Click **Sign In**.

### Step 3: Configure Servers

Apple Mail will attempt auto-detection. If it fails, you will be prompted for manual settings.

Select **IMAP** as the account type.

**Incoming Mail Server:**

| Field | Value |
|---|---|
| Mail Server | `mail.example.com` |
| User Name | `user@example.com` |
| Password | Your account password |

**Outgoing Mail Server:**

| Field | Value |
|---|---|
| SMTP Server | `mail.example.com` |
| User Name | `user@example.com` |
| Password | Your account password |

Click **Sign In**.

### Step 4: Verify Port Settings

If connection fails:

1. Go to **Mail** > **Settings** (or **Preferences**) > **Accounts**
2. Select your MyMail account
3. Click **Server Settings**
4. Under **Incoming Mail Server (IMAP)**:
   - Port: 993
   - Check **Use TLS/SSL**
   - Authentication: Password
5. Under **Outgoing Mail Server (SMTP)**:
   - Port: 465
   - Check **Use TLS/SSL**
   - Authentication: Password

---

## Other Clients

### Windows Mail / Windows 11 Outlook (new)

1. Open **Settings** > **Accounts** > **Email & accounts** > **Add account**
2. Select **Other account** (or **Advanced setup** > **Internet email**)
3. Fill in:
   - Email address: `user@example.com`
   - User name: `user@example.com`
   - Password: Your account password
   - Account name: MyMail
   - Incoming server: `mail.example.com`
   - Account type: IMAP4
   - Outgoing server: `mail.example.com`
4. Check: **Outgoing server requires authentication**, **Use same credentials**
5. Check: **Require SSL for incoming email**, **Require SSL for outgoing email**

### K-9 Mail / Thunderbird for Android

1. Open K-9 Mail and tap **Add Account**
2. Enter your email and password
3. Select **IMAP** for incoming
4. Configure:
   - Incoming: `mail.example.com`, port 993, SSL/TLS
   - Outgoing: `mail.example.com`, port 465, SSL/TLS
5. Tap **Done**

### FairEmail (Android)

1. Open FairEmail and go through the setup wizard
2. Select **Other provider**
3. Enter your name, email, and password
4. FairEmail will try auto-configuration. If manual setup is needed:
   - IMAP: `mail.example.com`, port 993, SSL/TLS
   - SMTP: `mail.example.com`, port 465, SSL/TLS

---

## Troubleshooting Client Issues

### "Cannot connect to server" or "Connection timed out"

1. Verify the server is running: `docker compose ps` on the server
2. Verify you are using `mail.example.com` (your HOSTNAME), not just `example.com`
3. Check that ports 993 and 465 are open in the firewall
4. Try using port 587 with STARTTLS instead of port 465 with SSL/TLS
5. Ensure you are not on a network that blocks mail ports (corporate/school networks often do)

### "Authentication failed" or "Wrong password"

1. Verify you are using the full email address as the username (e.g., `user@example.com`)
2. Try logging in via Roundcube webmail (`https://mail.example.com`) to confirm the password works
3. Check for special characters in the password that your client may not handle correctly

### "Certificate not trusted" or "Cannot verify server identity"

1. This usually means TLS certificates have not been provisioned yet by Caddy
2. Check Caddy logs: `docker compose logs caddy`
3. Ensure DNS A record for `mail.example.com` points to your server IP
4. Wait for Caddy to obtain certificates (usually 1-2 minutes after DNS resolves)
5. Do not accept self-signed certificate warnings for production use -- fix the certificate issue instead

### "SMTP send failed" or "Cannot send messages"

1. Verify SMTP settings: server, port, security type, and authentication
2. Try port 465 with SSL/TLS if port 587 with STARTTLS is not working (or vice versa)
3. Check Stalwart logs for authentication errors: `docker compose logs stalwart | grep auth`

### Emails not syncing or slow

1. Check your IMAP client settings for sync frequency
2. Some clients default to periodic polling (every 15-30 minutes). Enable push notifications/IDLE if available.
3. Check server load: `docker stats --no-stream`

### Sent messages not appearing in Sent folder

Some clients default to saving sent messages locally. Configure the client to use the server's Sent folder:

- **Thunderbird:** Account Settings > Copies & Folders > "Place a copy in: Sent folder on server"
- **iOS Mail:** Settings > Mail > Accounts > [account] > [account name] > Advanced > Sent Mailbox > select the server's Sent folder
- **Apple Mail:** Mail > Settings > Accounts > [account] > Mailbox Behaviors > Sent Mailbox > select server
