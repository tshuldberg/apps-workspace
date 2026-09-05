# Backup and Restore Guide

MyMail uses [Restic](https://restic.net) for encrypted, deduplicated backups to S3-compatible object storage. Backups include mail data, configuration files, and databases.

---

## Table of Contents

- [What Gets Backed Up](#what-gets-backed-up)
- [Storage Provider Setup](#storage-provider-setup)
  - [Backblaze B2 (Recommended)](#backblaze-b2-recommended)
  - [AWS S3](#aws-s3)
  - [MinIO (Self-Hosted)](#minio-self-hosted)
- [Configuring Backups](#configuring-backups)
- [Installing Restic](#installing-restic)
- [Running a Manual Backup](#running-a-manual-backup)
- [Automated Daily Backups](#automated-daily-backups)
- [Listing and Inspecting Backups](#listing-and-inspecting-backups)
- [Restore Procedures](#restore-procedures)
  - [Full Restore](#full-restore)
  - [Partial Restore (Single File)](#partial-restore-single-file)
  - [Restore to a Different Server](#restore-to-a-different-server)
- [Verifying Backups](#verifying-backups)
- [Backup Retention and Pruning](#backup-retention-and-pruning)
- [Troubleshooting](#troubleshooting)

---

## What Gets Backed Up

The backup script (`scripts/backup.sh`) captures:

| Data | Source | Contains |
|---|---|---|
| Stalwart mail data | `mymail-stalwart:/opt/stalwart-mail/data` | All emails, user accounts, indexes |
| Roundcube database | `mymail-roundcube:/var/roundcube/db` | Contacts, settings, identity data |
| Redis dump | `mymail-redis:/data/dump.rdb` | Rspamd Bayes training, rate limit state |
| Stalwart config | `stalwart/config/` | `config.toml`, DKIM keys |
| Rspamd config | `rspamd/local.d/` | Spam filter rules and thresholds |
| Roundcube config | `roundcube/config/` | `config.inc.php` |
| Caddy config | `caddy/` | `Caddyfile` |
| Environment | `.env` | All configuration variables |
| Docker Compose | `docker-compose.yml` | Service definitions |

All backup data is encrypted with your `RESTIC_PASSWORD` before upload.

---

## Storage Provider Setup

### Backblaze B2 (Recommended)

Backblaze B2 is the most cost-effective option at $0.005/GB/month for storage and $0.01/GB for downloads. A typical MyMail backup uses 1-5 GB.

**Step 1: Create a Backblaze Account**

Sign up at [backblaze.com](https://www.backblaze.com/b2/cloud-storage.html). The first 10 GB of storage is free.

**Step 2: Create a Bucket**

1. Log in to the Backblaze console
2. Go to **Buckets** and click **Create a Bucket**
3. Bucket name: `mymail-backups` (must be globally unique, add a suffix if needed)
4. Files in bucket: **Private**
5. Encryption: **Enabled** (server-side encryption in addition to Restic's client-side encryption)
6. Click **Create a Bucket**
7. Note the **Endpoint** shown (e.g., `s3.us-west-000.backblazeb2.com`)

**Step 3: Create an Application Key**

1. Go to **App Keys** and click **Add a New Application Key**
2. Name: `mymail-backup`
3. Allow access to: Select your bucket
4. Type of access: **Read and Write**
5. Click **Create New Key**
6. **Save both values immediately** (the secret is only shown once):
   - `keyID` = your `BACKUP_S3_KEY`
   - `applicationKey` = your `BACKUP_S3_SECRET`

**Step 4: Configure MyMail**

```bash
BACKUP_ENABLED=true
BACKUP_S3_ENDPOINT=s3.us-west-000.backblazeb2.com
BACKUP_S3_BUCKET=mymail-backups
BACKUP_S3_KEY=000a1b2c3d4e5f0000000000
BACKUP_S3_SECRET=K000abcdefghijklmnopqrstuvwxyz
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION=30
```

### AWS S3

**Step 1: Create an S3 Bucket**

1. Open the [S3 console](https://console.aws.amazon.com/s3/)
2. Click **Create bucket**
3. Bucket name: `mymail-backups-yourdomain` (globally unique)
4. Region: Choose the same region as your server
5. Block all public access: **Enabled** (checked)
6. Bucket Versioning: **Disabled** (Restic handles versioning)
7. Default encryption: **SSE-S3**
8. Click **Create bucket**

**Step 2: Create an IAM User**

1. Open the [IAM console](https://console.aws.amazon.com/iam/)
2. Go to **Users** and click **Create user**
3. User name: `mymail-backup`
4. Select **Programmatic access**
5. Attach the following inline policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource": [
                "arn:aws:s3:::mymail-backups-yourdomain",
                "arn:aws:s3:::mymail-backups-yourdomain/*"
            ]
        }
    ]
}
```

6. Create the user and save the Access Key ID and Secret Access Key

**Step 3: Configure MyMail**

```bash
BACKUP_ENABLED=true
BACKUP_S3_ENDPOINT=s3.us-east-1.amazonaws.com
BACKUP_S3_BUCKET=mymail-backups-yourdomain
BACKUP_S3_KEY=AKIAIOSFODNN7EXAMPLE
BACKUP_S3_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLE
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION=30
```

Replace `us-east-1` with your actual bucket region.

### MinIO (Self-Hosted)

If you prefer to host your own S3-compatible storage:

```bash
BACKUP_ENABLED=true
BACKUP_S3_ENDPOINT=minio.yourdomain.com:9000
BACKUP_S3_BUCKET=mymail-backups
BACKUP_S3_KEY=minioadmin
BACKUP_S3_SECRET=minioadmin
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION=30
```

**Important:** Do not host MinIO on the same server as MyMail. If the server fails, you lose both the data and the backups.

---

## Configuring Backups

Edit your `.env` file with the storage provider settings from above. Key parameters:

```bash
# Enable backups
BACKUP_ENABLED=true

# S3 connection (see provider setup above)
BACKUP_S3_ENDPOINT=s3.us-west-000.backblazeb2.com
BACKUP_S3_BUCKET=mymail-backups
BACKUP_S3_KEY=your-key-id
BACKUP_S3_SECRET=your-secret-key

# Schedule: daily at 2:00 AM server time (cron format)
BACKUP_SCHEDULE=0 2 * * *

# Keep backups for 30 days
BACKUP_RETENTION=30

# Encryption password (generated by setup.sh)
RESTIC_PASSWORD=your-restic-password
```

**Critical:** Store your `RESTIC_PASSWORD` in a password manager or other secure location outside your server. If you lose this password, your backups cannot be decrypted.

---

## Installing Restic

Restic must be installed on the host system (not inside a container):

```bash
# Ubuntu/Debian
apt install -y restic

# Or install the latest version directly
curl -L https://github.com/restic/restic/releases/latest/download/restic_$(curl -s https://api.github.com/repos/restic/restic/releases/latest | grep tag_name | cut -d '"' -f4 | tr -d v)_linux_amd64.bz2 | bunzip2 > /usr/local/bin/restic
chmod +x /usr/local/bin/restic
```

Verify installation:

```bash
restic version
```

---

## Running a Manual Backup

```bash
cd /path/to/mymail
./scripts/backup.sh
```

The script performs these steps:

1. **Pre-flight checks** -- Verifies Restic is installed and S3 credentials are configured
2. **Initialize repository** -- Creates the Restic repository on first run
3. **Export data** -- Briefly pauses SMTP, copies data from Docker volumes, resumes SMTP
4. **Upload** -- Encrypts and uploads the data to S3
5. **Verify** -- Checks backup integrity (random 5% of data)
6. **Prune** -- Removes old backups based on retention policy

The SMTP pause is typically under 10 seconds. Incoming emails during this brief window are queued by the sending server and retried.

---

## Automated Daily Backups

Set up a cron job to run backups automatically:

```bash
# Edit the root crontab
crontab -e
```

Add the following line (adjust the path):

```
0 2 * * * /path/to/mymail/scripts/backup.sh >> /path/to/mymail/logs/backup-cron.log 2>&1
```

This runs the backup at 2:00 AM daily. The `BACKUP_SCHEDULE` variable in `.env` is informational -- the actual schedule is controlled by cron.

Verify the cron job is saved:

```bash
crontab -l
```

---

## Listing and Inspecting Backups

Set up the environment variables for Restic commands:

```bash
# Source the environment
cd /path/to/mymail
source .env

export RESTIC_REPOSITORY="s3:https://${BACKUP_S3_ENDPOINT}/${BACKUP_S3_BUCKET}"
export AWS_ACCESS_KEY_ID="$BACKUP_S3_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET"
export RESTIC_PASSWORD
```

**List all snapshots:**

```bash
restic snapshots --tag mymail
```

**Example output:**

```
ID        Time                 Host        Tags
----------------------------------------------------------------------
a1b2c3d4  2025-01-15 02:00:05  mail        mymail,2025-01-15
e5f6g7h8  2025-01-16 02:00:03  mail        mymail,2025-01-16
i9j0k1l2  2025-01-17 02:00:04  mail        mymail,2025-01-17
----------------------------------------------------------------------
3 snapshots
```

**View contents of a snapshot:**

```bash
restic ls a1b2c3d4
```

**Show snapshot statistics:**

```bash
restic stats --tag mymail
```

---

## Restore Procedures

### Full Restore

The restore script handles a complete system restore:

```bash
./scripts/restore.sh
```

The script will:

1. Show available backup snapshots
2. Prompt you to select a snapshot ID (or `latest`)
3. Ask for confirmation (type `YES`)
4. Stop all MyMail services
5. Download and decrypt the selected snapshot
6. Restore Stalwart mail data, Roundcube database, Redis data, and all configuration files
7. Restart all services
8. Report the health status

**Example session:**

```
Available backups:

ID        Time                 Host        Tags
----------------------------------------------------------------------
a1b2c3d4  2025-01-15 02:00:05  mail        mymail,2025-01-15
e5f6g7h8  2025-01-16 02:00:03  mail        mymail,2025-01-16
----------------------------------------------------------------------

Enter snapshot ID to restore (or 'latest'): latest

WARNING: This will stop all MyMail services and replace data.
Current data will be overwritten by the backup.

Are you sure you want to continue? (type YES to confirm): YES
```

### Partial Restore (Single File)

To restore specific files without a full restore:

```bash
# Source environment variables (as shown above)
source .env
export RESTIC_REPOSITORY="s3:https://${BACKUP_S3_ENDPOINT}/${BACKUP_S3_BUCKET}"
export AWS_ACCESS_KEY_ID="$BACKUP_S3_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET"
export RESTIC_PASSWORD

# Restore a specific directory from the latest snapshot
restic restore latest --target /tmp/partial-restore --include "stalwart-config"

# Restore a specific file
restic restore latest --target /tmp/partial-restore --include "env-backup"
```

Then manually copy the needed files to their correct locations.

### Restore to a Different Server

To migrate MyMail to a new server using a backup:

1. **On the new server**, install Docker, clone MyMail, and run initial setup:

   ```bash
   git clone https://github.com/yourusername/mymail.git
   cd mymail
   ```

2. **Copy the `.env` file** from your backup or old server. The `RESTIC_PASSWORD` and backup S3 credentials are required.

3. **Install Restic** on the new server:

   ```bash
   apt install -y restic
   ```

4. **Run the restore script:**

   ```bash
   ./scripts/restore.sh
   ```

5. **Update DNS records** to point to the new server IP.

6. **Update `.env`** with the new `SERVER_IP`.

7. **Restart services** to pick up the new IP:

   ```bash
   docker compose down && docker compose up -d
   ```

---

## Verifying Backups

Regular verification ensures your backups are not corrupted.

**Quick integrity check (checks metadata):**

```bash
restic check
```

**Deep integrity check (verifies actual data, slower):**

```bash
restic check --read-data
```

**Partial data check (verifies 10% of data, faster):**

```bash
restic check --read-data-subset=10%
```

**Recommended:** Schedule a monthly verification:

```bash
# Add to crontab
0 4 1 * * source /path/to/mymail/.env && \
  RESTIC_REPOSITORY="s3:https://${BACKUP_S3_ENDPOINT}/${BACKUP_S3_BUCKET}" \
  AWS_ACCESS_KEY_ID="$BACKUP_S3_KEY" \
  AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET" \
  RESTIC_PASSWORD="$RESTIC_PASSWORD" \
  restic check --read-data-subset=25% >> /path/to/mymail/logs/backup-verify.log 2>&1
```

---

## Backup Retention and Pruning

The backup script automatically prunes old backups based on this policy:

| Rule | Retention |
|---|---|
| Daily backups | Keep last 7 |
| Weekly backups | Keep last 4 |
| Monthly backups | Keep last 6 |
| Within retention period | Keep all (default: 30 days) |

To change the retention period, update `BACKUP_RETENTION` in `.env`:

```bash
# Keep backups for 90 days instead of 30
BACKUP_RETENTION=90
```

To manually prune:

```bash
# Source environment variables as shown above, then:
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --keep-within 30d --prune --tag mymail
```

To see how much space pruning would free without actually deleting:

```bash
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --keep-within 30d --dry-run --tag mymail
```

---

## Troubleshooting

**Problem: "restic is not installed"**

Install Restic:
```bash
apt install -y restic
```

**Problem: "S3 endpoint and bucket must be configured"**

Verify your `.env` has all required backup variables set:
```bash
grep BACKUP .env
```

**Problem: "unable to open repository" or S3 authentication errors**

- Verify `BACKUP_S3_KEY` and `BACKUP_S3_SECRET` are correct
- Check the endpoint URL matches your provider and region
- For Backblaze B2, ensure the application key has access to the bucket
- Test connectivity: `curl -I https://BACKUP_S3_ENDPOINT`

**Problem: "repository does not exist"**

On first run, the backup script initializes the repository automatically. If this fails, initialize manually:

```bash
source .env
export RESTIC_REPOSITORY="s3:https://${BACKUP_S3_ENDPOINT}/${BACKUP_S3_BUCKET}"
export AWS_ACCESS_KEY_ID="$BACKUP_S3_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET"
export RESTIC_PASSWORD

restic init
```

**Problem: Backup is very slow**

- Check your server's upload speed: `curl -o /dev/null https://speed.cloudflare.com/__down?bytes=10000000`
- Restic uses deduplication, so after the first backup, subsequent backups only upload changed data
- If your mail data is very large (>10 GB), the first backup may take hours

**Problem: "RESTIC_PASSWORD" error during restore**

You must use the same `RESTIC_PASSWORD` that was used when the backup was created. This password is in your `.env` file. If you lost it, the backups cannot be decrypted.

**Problem: Restore script fails with "Could not find backup data in snapshot"**

The snapshot may be from an incompatible version or corrupted. Try:
```bash
restic ls SNAPSHOT_ID
```
to inspect its contents and verify the expected directory structure.
