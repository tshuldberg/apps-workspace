# Changelog

All notable changes to MyMail will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-21

### Added
- Initial project structure with Docker Compose orchestration
- Stalwart mail server with SMTP (25, 465, 587), IMAP (993), JMAP (8080), and ManageSieve (4190)
- Rspamd spam filtering with milter integration and Bayesian learning
- Redis for caching and Rspamd backend
- Caddy reverse proxy with automatic Let's Encrypt TLS certificates
- Roundcube webmail with PHP-FPM
- SvelteKit admin dashboard with Tailwind CSS
  - Dashboard with service health overview
  - Account management (create, edit, delete email accounts)
  - Domain management with DNS record display
  - Spam statistics and Rspamd integration
  - Mail server statistics and charts
  - Backup management interface
- Setup wizard with interactive configuration
  - Prerequisite checking (Docker, Docker Compose, OpenSSL)
  - Domain and hostname configuration
  - Automatic admin password generation
  - DKIM key generation (Ed25519 + RSA-2048)
  - DNS record display with copy-ready values
- Backup system using Restic to S3-compatible storage
  - Automatic daily backups with cron scheduling
  - Encrypted backup with configurable retention
  - Backup verification with integrity checking
  - Restore script with snapshot selection
- Health check script verifying all services, ports, HTTPS, DNS, and IP blacklists
- DNS validation script with comprehensive record checking
- Development configuration with Docker Compose override and local Caddyfile
- Comprehensive documentation covering setup, configuration, DNS, relay, backup, security, troubleshooting, architecture, mobile clients, and migration
- Static landing page with responsive design
- GitHub Actions CI/CD pipelines (CI and release)
- GitHub issue and PR templates
- AGPL-3.0 license
