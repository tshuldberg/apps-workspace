# Migration Guide

This guide walks you through migrating your existing email from major providers to your MyMail server. Migration preserves your email history, folder structure, and (where possible) labels.

---

## Table of Contents

- [Before You Begin](#before-you-begin)
- [Migration Tool: imapsync](#migration-tool-imapsync)
- [Migrate from Gmail](#migrate-from-gmail)
  - [Method 1: imapsync (Recommended)](#method-1-imapsync-recommended)
  - [Method 2: Google Takeout](#method-2-google-takeout)
- [Migrate from Outlook / Hotmail](#migrate-from-outlook--hotmail)
- [Migrate from Yahoo Mail](#migrate-from-yahoo-mail)
- [Migrate from Another IMAP Server](#migrate-from-another-imap-server)
- [Post-Migration Steps](#post-migration-steps)
- [Forwarding During Transition](#forwarding-during-transition)
- [Troubleshooting](#troubleshooting)

---

## Before You Begin

1. **Set up your MyMail server** completely following the [QUICKSTART.md](QUICKSTART.md) guide
2. **Create a user account** on your MyMail server (via the admin dashboard or during setup)
3. **Verify you can send and receive email** on the new server
4. **Estimate migration time**: 1 GB of email takes approximately 30-60 minutes to migrate over a good connection
5. **Plan for a transition period**: Keep your old account active and set up forwarding while you transition

---

## Migration Tool: imapsync

[imapsync](https://imapsync.lamiral.info/) is the standard tool for migrating email between IMAP servers. It copies messages from a source server to a destination server, preserving folder structure, flags (read/unread/starred), and dates.

### Install imapsync

```bash
# Ubuntu / Debian
apt install -y imapsync

# Or install from source (latest version)
apt install -y libauthen-ntlm-perl libclass-load-perl libcrypt-openssl-rsa-perl \
  libdata-uniqid-perl libdigest-hmac-perl libdist-checkconflicts-perl \
  libencode-imaputf7-perl libfile-copy-recursive-perl libfile-tail-perl \
  libio-compress-perl libio-socket-inet6-perl libio-socket-ssl-perl \
  libio-tee-perl libmail-imapclient-perl libmodule-scandeps-perl \
  libnet-dbus-perl libnet-ssleay-perl libpar-packer-perl \
  libreadonly-perl libregexp-common-perl libsys-meminfo-perl \
  libterm-readkey-perl libtest-mockobject-perl libtest-pod-perl \
  libunicode-string-perl liburi-perl libwww-perl

curl -L https://raw.githubusercontent.com/imapsync/imapsync/master/imapsync -o /usr/local/bin/imapsync
chmod +x /usr/local/bin/imapsync
```

### Basic imapsync Syntax

```bash
imapsync \
  --host1 SOURCE_IMAP_SERVER --port1 993 --ssl1 \
  --user1 "source@email.com" --password1 "source-password" \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "user@example.com" --password2 "dest-password"
```

---

## Migrate from Gmail

### Prerequisites

Before migrating from Gmail, you need to enable IMAP access and create an App Password (Google disabled regular password login for third-party apps).

**Step 1: Enable IMAP in Gmail**

1. Open Gmail in a browser
2. Click the gear icon > **See all settings**
3. Go to the **Forwarding and POP/IMAP** tab
4. Under IMAP access, select **Enable IMAP**
5. Click **Save Changes**

**Step 2: Generate an App Password**

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - If you do not see this option, you must enable 2-Step Verification first at [myaccount.google.com/signinoptions/two-step-verification](https://myaccount.google.com/signinoptions/two-step-verification)
2. Select app: **Mail**
3. Select device: **Other** (enter "imapsync")
4. Click **Generate**
5. Copy the 16-character app password (e.g., `abcd efgh ijkl mnop`)
6. **Save this password** -- you will need it for the migration

### Method 1: imapsync (Recommended)

This method copies all email directly from Gmail's IMAP server to your MyMail server.

**Run the migration:**

```bash
imapsync \
  --host1 imap.gmail.com --port1 993 --ssl1 \
  --user1 "yourname@gmail.com" --password1 "abcdefghijklmnop" \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "user@example.com" --password2 "your-mymail-password" \
  --gmail1 \
  --automap \
  --exclude "^\[Gmail\]/All Mail$" \
  --exclude "^\[Gmail\]/Important$"
```

**Explanation of flags:**

- `--gmail1`: Enables Gmail-specific IMAP handling (label-to-folder mapping)
- `--automap`: Automatically maps Gmail special folders (Sent, Drafts, Trash, Spam) to the destination equivalents
- `--exclude "^\[Gmail\]/All Mail$"`: Skips the "All Mail" folder (contains duplicates of every message)
- `--exclude "^\[Gmail\]/Important$"`: Skips the "Important" folder (duplicate label)

**What gets migrated:**

| Gmail | MyMail |
|---|---|
| Inbox | INBOX |
| Sent Mail | Sent |
| Drafts | Drafts |
| Spam | Junk |
| Trash | Trash |
| Starred | Flagged |
| Labels (e.g., "Work", "Personal") | Folders with matching names |

**Dry run (test without copying):**

```bash
imapsync \
  --host1 imap.gmail.com --port1 993 --ssl1 \
  --user1 "yourname@gmail.com" --password1 "abcdefghijklmnop" \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "user@example.com" --password2 "your-mymail-password" \
  --gmail1 --automap --dry --justfolders
```

This lists the folders that would be created without copying any messages.

**Resume an interrupted migration:**

imapsync tracks progress and can resume from where it left off. Simply run the same command again -- it will skip already-migrated messages.

### Method 2: Google Takeout

Use this method if you cannot enable IMAP or prefer an offline migration.

**Step 1: Export from Google Takeout**

1. Go to [takeout.google.com](https://takeout.google.com)
2. Click **Deselect all**
3. Scroll down and select only **Mail**
4. Click **Next step**
5. Choose delivery method: **Send download link via email**
6. Choose file type: **.zip**
7. Choose file size: **10 GB** (or adjust based on mailbox size)
8. Click **Create export**
9. Wait for the email with download link(s) (can take hours to days for large mailboxes)
10. Download and extract the archive

**Step 2: Process the MBOX files**

Google Takeout exports email in MBOX format. You need to import these into your MyMail server.

First, install the required tools on your server:

```bash
apt install -y mb2md
```

**Step 3: Convert MBOX to Maildir**

```bash
# For each MBOX file
mb2md -s /path/to/All\ mail\ Including\ Spam\ and\ Trash.mbox -d /tmp/maildir-import
```

**Step 4: Import via IMAP**

Use `imapsync` to copy from a local Maildir to your server. Alternatively, use a tool like `doveadm` or directly copy files if you have access to the Stalwart data volume.

A simpler approach is to use a local IMAP server temporarily:

```bash
# Install dovecot locally
apt install -y dovecot-imapd

# Configure a local user and copy maildir
# Then use imapsync from the local IMAP to your MyMail server
```

**Recommendation:** Method 1 (direct imapsync) is significantly easier and more reliable. Use Google Takeout only as a backup export or archive.

---

## Migrate from Outlook / Hotmail

Microsoft accounts (Outlook.com, Hotmail, Live.com) support IMAP access.

### Step 1: Enable IMAP (if not already enabled)

IMAP is enabled by default for most Microsoft accounts. If not:

1. Go to [outlook.live.com](https://outlook.live.com)
2. Click the gear icon > **View all Outlook settings**
3. Go to **Mail** > **Sync email**
4. Under POP and IMAP, ensure IMAP is enabled

### Step 2: Generate an App Password

If you have two-factor authentication enabled:

1. Go to [account.microsoft.com/security](https://account.microsoft.com/security)
2. Click **Advanced security options**
3. Under App passwords, click **Create a new app password**
4. Copy the generated password

If you do not have 2FA, you can use your regular password, but Microsoft may block the sign-in and send you a security alert. Approve it from your Microsoft account security page.

### Step 3: Run imapsync

```bash
imapsync \
  --host1 outlook.office365.com --port1 993 --ssl1 \
  --user1 "yourname@outlook.com" --password1 "your-app-password" \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "user@example.com" --password2 "your-mymail-password" \
  --automap \
  --office1
```

The `--office1` flag handles Microsoft-specific IMAP quirks.

**Folder mapping:**

| Outlook | MyMail |
|---|---|
| Inbox | INBOX |
| Sent Items | Sent |
| Drafts | Drafts |
| Junk Email | Junk |
| Deleted Items | Trash |
| Custom folders | Preserved as-is |

---

## Migrate from Yahoo Mail

### Step 1: Generate an App Password

Yahoo requires an app-specific password:

1. Go to [login.yahoo.com/account/security](https://login.yahoo.com/account/security)
2. Click **Generate app password** (or **Manage app passwords**)
3. Select app: **Other App** and enter "imapsync"
4. Click **Generate**
5. Copy the app password

### Step 2: Run imapsync

```bash
imapsync \
  --host1 imap.mail.yahoo.com --port1 993 --ssl1 \
  --user1 "yourname@yahoo.com" --password1 "your-app-password" \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "user@example.com" --password2 "your-mymail-password" \
  --automap
```

**Folder mapping:**

| Yahoo | MyMail |
|---|---|
| Inbox | INBOX |
| Sent | Sent |
| Draft | Drafts |
| Bulk Mail | Junk |
| Trash | Trash |
| Custom folders | Preserved as-is |

---

## Migrate from Another IMAP Server

For any IMAP server (self-hosted, Fastmail, ProtonMail Bridge, Zoho, etc.):

```bash
imapsync \
  --host1 imap.source-server.com --port1 993 --ssl1 \
  --user1 "user@source-domain.com" --password1 "source-password" \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "user@example.com" --password2 "your-mymail-password" \
  --automap
```

### Common IMAP Servers

| Provider | IMAP Server | Port |
|---|---|---|
| Gmail | `imap.gmail.com` | 993 |
| Outlook / Hotmail | `outlook.office365.com` | 993 |
| Yahoo | `imap.mail.yahoo.com` | 993 |
| iCloud | `imap.mail.me.com` | 993 |
| Fastmail | `imap.fastmail.com` | 993 |
| Zoho | `imap.zoho.com` | 993 |
| ProtonMail | Use ProtonMail Bridge (localhost:1143) | 1143 |
| Yandex | `imap.yandex.com` | 993 |
| GMX | `imap.gmx.com` | 993 |

### Migrating Multiple Users

If you are migrating several accounts, create a batch script:

```bash
#!/bin/bash
# migrate-all.sh

# User 1
imapsync \
  --host1 imap.gmail.com --port1 993 --ssl1 \
  --user1 "alice@gmail.com" --passfile1 /tmp/alice-pass \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "alice@example.com" --passfile2 /tmp/alice-newpass \
  --gmail1 --automap \
  --log --logdir /var/log/imapsync/

# User 2
imapsync \
  --host1 imap.gmail.com --port1 993 --ssl1 \
  --user1 "bob@gmail.com" --passfile1 /tmp/bob-pass \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "bob@example.com" --passfile2 /tmp/bob-newpass \
  --gmail1 --automap \
  --log --logdir /var/log/imapsync/
```

Use `--passfile1` and `--passfile2` instead of `--password1`/`--password2` to avoid passwords appearing in process listings.

---

## Post-Migration Steps

After the migration completes:

### 1. Verify Email Count

Check that the message counts match between source and destination:

```bash
# imapsync output shows message counts per folder
# Or check via webmail at https://mail.example.com
```

### 2. Set Up Email Forwarding on Old Account

Configure your old email provider to forward new messages to your MyMail address during the transition period.

**Gmail:** Settings > Forwarding and POP/IMAP > Add a forwarding address > enter `user@example.com` > verify

**Outlook:** Settings > Mail > Forwarding > Enable forwarding > enter `user@example.com`

**Yahoo:** Settings > More Settings > Mailboxes > enter forwarding address

### 3. Update Your Email Everywhere

Update your email address on:
- Online accounts (banks, social media, subscriptions)
- Contact information (business cards, signatures, websites)
- Mailing lists and newsletters
- Government and official accounts

### 4. Configure Email Clients

Set up your phone, desktop, and other devices with the new server. See [MOBILE_SETUP.md](MOBILE_SETUP.md).

### 5. Set Up Filters and Rules

If you had filters in Gmail or Outlook, recreate them using Sieve rules (via Roundcube > Settings > Filters) or ManageSieve (via Thunderbird).

### 6. Monitor for Missed Messages

Keep your old account active for at least 1-3 months to catch any messages that were sent to the old address. Check it periodically or rely on forwarding.

### 7. Run a Second imapsync Pass

After a few days, run imapsync again to catch any new messages that arrived between the first migration and when forwarding was set up:

```bash
# Same command as before - imapsync will only copy new messages
imapsync \
  --host1 imap.gmail.com --port1 993 --ssl1 \
  --user1 "yourname@gmail.com" --password1 "app-password" \
  --host2 mail.example.com --port2 993 --ssl2 \
  --user2 "user@example.com" --password2 "your-password" \
  --gmail1 --automap
```

---

## Forwarding During Transition

During the transition period, you want both old and new accounts to receive email. Here is the recommended approach:

```
Phase 1 (Day 1): Migrate all existing email with imapsync
Phase 2 (Day 1): Enable forwarding on old account to new address
Phase 3 (Day 1-7): Update MX records to point to your MyMail server
Phase 4 (Week 1-4): Update email address on important accounts
Phase 5 (Month 1-3): Monitor old account, run periodic imapsync
Phase 6 (Month 3+): Disable old account forwarding, fully transitioned
```

**If you own the domain:** Update MX records to point to your MyMail server. This is the cleanest migration path since your email address does not change.

**If you are changing email addresses:** (e.g., `user@gmail.com` to `user@example.com`), set up forwarding and gradually update your address on all services.

---

## Troubleshooting

### "Login failed" on source server

- **Gmail:** Ensure IMAP is enabled and you are using an App Password (not your regular password)
- **Outlook:** Try enabling "Let less secure apps access your account" or use an App Password
- **Yahoo:** Use an App Password generated from the security settings
- **All:** Check for 2FA requirements

### imapsync hangs or is very slow

- Large mailboxes take time. 10 GB can take several hours.
- Use `--nolog` to reduce disk I/O if logging is causing slowness.
- Use `--maxsize 26214400` to skip messages larger than 25 MB (can be imported later).
- Run the migration from a server with a good connection (e.g., from your VPS, not from home).

### "Folder creation failed" or "Permission denied"

- Check that the destination user has permission to create folders
- Some IMAP servers have folder limits. Stalwart does not have a hard limit by default.
- Try creating the folder manually via webmail first

### Duplicate messages after migration

imapsync uses message-IDs to avoid duplicates. If you see duplicates:

- Do not run imapsync with `--delete2duplicates` on the first run
- Check if the source has the same message in multiple folders (Gmail labels cause this)
- Use `--exclude "^\[Gmail\]/All Mail$"` when migrating from Gmail

### Special characters in folder names

If folder names contain special characters:

```bash
imapsync ... --regextrans2 's/[^a-zA-Z0-9 ._-]/_/g'
```

This replaces non-ASCII characters with underscores.

### Migration log files

imapsync creates detailed logs. Check them for errors:

```bash
# Logs are created in the current directory by default
ls -la *.txt

# Or specify a log directory
imapsync ... --log --logdir /var/log/imapsync/
```
