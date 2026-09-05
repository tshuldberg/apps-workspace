---
name: Bug Report
about: Report a bug or unexpected behavior in MyMail
title: "[Bug] "
labels: bug
assignees: ""
---

## Environment

- **MyMail version**: (e.g., 0.1.0 -- check CHANGELOG.md or git tag)
- **Operating system**: (e.g., Ubuntu 24.04 LTS, Debian 12)
- **Docker version**: (output of `docker --version`)
- **Docker Compose version**: (output of `docker compose version`)
- **Deployment type**: Fresh install / Upgrade from version ___

## Description

A clear description of the bug.

## Steps to Reproduce

1. ...
2. ...
3. ...

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened.

## Logs

Paste relevant logs below. You can gather them with:

```bash
# All services
docker compose logs --tail=100

# Specific service (stalwart, rspamd, caddy, roundcube, admin-ui, redis)
docker compose logs --tail=100 stalwart
```

<details>
<summary>Log output</summary>

```
(paste logs here)
```

</details>

## Health Check Output

If applicable, paste the output of `./scripts/health-check.sh`:

<details>
<summary>Health check output</summary>

```
(paste output here)
```

</details>

## Additional Context

Add any other context, screenshots, or configuration details (with secrets redacted) that may help diagnose the issue.
