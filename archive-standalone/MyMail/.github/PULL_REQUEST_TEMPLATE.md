## Description

Provide a clear summary of the changes in this PR and the motivation behind them.

Closes #(issue number)

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Configuration change (Docker Compose, Caddyfile, Stalwart config, Rspamd config)
- [ ] Documentation update
- [ ] Refactor (no functional changes)
- [ ] CI/CD or build changes

## Changes Made

List the specific changes:

- ...
- ...

## Testing Performed

Describe how you tested these changes:

- [ ] Ran `docker compose build` successfully
- [ ] Ran `docker compose up` and verified services start
- [ ] Ran `./scripts/health-check.sh` with all checks passing
- [ ] Tested affected functionality manually (describe below)
- [ ] Verified no regressions in other services

### Test details

(Describe specific test scenarios and their outcomes)

## Checklist

- [ ] I have read the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines
- [ ] My changes follow the existing code style of this project
- [ ] I have tested my changes in a Docker Compose environment
- [ ] I have updated documentation if needed (README, inline comments, etc.)
- [ ] I have updated CHANGELOG.md with a summary of my changes
- [ ] My changes do not introduce new warnings or errors in build output
- [ ] Any new environment variables are documented in `.env.example`
- [ ] Shell scripts pass `shellcheck` without errors
- [ ] No secrets, passwords, or private keys are included in this PR
