# Contributing to MyMail

Thank you for your interest in contributing to MyMail. This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Be kind, constructive, and professional in all interactions.

Unacceptable behavior includes:
- Harassment, intimidation, or discrimination
- Trolling, insults, or personal attacks
- Publishing others' private information
- Any conduct that would be considered inappropriate in a professional setting

Project maintainers may remove, edit, or reject contributions that violate this code.

## How to Report Bugs

1. **Search existing issues** to avoid duplicates.
2. **Use the bug report template** when creating a new issue.
3. Include:
   - MyMail version (check `docker compose ps` output)
   - Operating system and Docker version
   - Steps to reproduce the issue
   - Expected vs. actual behavior
   - Relevant log output (`docker compose logs <service>`)

## How to Suggest Features

1. **Search existing issues** to see if the feature has been discussed.
2. **Use the feature request template** when creating a new issue.
3. Describe:
   - The problem the feature would solve
   - Your proposed solution
   - Any alternatives you considered

## Development Setup

### Prerequisites

- Docker and Docker Compose v2
- Node.js 20+ (for admin UI development)
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/mymail.git
cd mymail

# Copy environment template
cp .env.example .env
# Edit .env with your development values

# Start in development mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# For admin UI development
cd admin-ui
npm install
npm run dev
```

### Development Architecture

- **admin-ui/** -- SvelteKit application (Svelte 5, Tailwind CSS 4, TypeScript)
- **caddy/** -- Caddyfile configurations (production and dev)
- **rspamd/local.d/** -- Rspamd local overrides
- **roundcube/config/** -- Roundcube PHP configuration
- **scripts/** -- Shell scripts (setup, backup, restore, health check, DNS validation)
- **stalwart/config/** -- Stalwart mail server TOML configuration

### Running Tests

```bash
# Build all containers
docker compose build

# Start services and run health check
docker compose up -d
sleep 30
./scripts/health-check.sh

# Admin UI linting and build check
cd admin-ui
npm run build
```

## Code Style and Conventions

### Shell Scripts

- Use `#!/usr/bin/env bash` shebang
- Enable strict mode: `set -euo pipefail`
- Use consistent color/logging functions (`info`, `ok`, `warn`, `error`)
- Quote all variable expansions
- Use `local` for function-scoped variables
- Add comments for non-obvious logic

### SvelteKit / TypeScript

- Use TypeScript for all `.ts` and `.svelte` files
- Follow Svelte 5 conventions (runes, etc.)
- Use Tailwind CSS for styling -- avoid custom CSS where possible
- Keep components focused and composable
- Use `$lib/` imports for shared code

### Configuration Files

- Comment sections clearly with separator lines
- Use environment variable substitution where possible
- Group related settings under clear headings

### Docker

- Use Alpine-based images where available
- Set resource limits on all services
- Include health checks for every service
- Pin major image versions (e.g., `redis:7-alpine`, `caddy:2-alpine`)

## Pull Request Process

1. **Fork the repository** and create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes**, following the code style guidelines above.

3. **Test your changes**:
   - Ensure `docker compose build` succeeds
   - Ensure `docker compose up -d` starts all services
   - Run `./scripts/health-check.sh` and verify it passes
   - For UI changes, verify in a browser

4. **Write a clear commit message** describing what and why:
   ```
   feat: add per-domain relay configuration

   Allows setting different outbound relays per domain, useful for
   users hosting multiple domains with different SES regions.
   ```

5. **Open a pull request** against `main`:
   - Use the PR template
   - Reference any related issues
   - Describe what the PR does and how to test it

6. **Respond to review feedback** promptly.

### Commit Message Format

Use conventional commit prefixes:

| Prefix     | Usage                                    |
|------------|------------------------------------------|
| `feat:`    | New feature                              |
| `fix:`     | Bug fix                                  |
| `docs:`    | Documentation only                       |
| `refactor:`| Code change that doesn't fix/add         |
| `test:`    | Adding or updating tests                 |
| `chore:`   | Build, CI, dependency updates            |

## Testing Requirements

Before submitting a PR, verify:

- [ ] All containers build successfully (`docker compose build`)
- [ ] All services start and pass health checks
- [ ] No regressions in existing functionality
- [ ] New scripts are executable and have proper shebangs
- [ ] Documentation is updated if behavior changes

## Questions?

Open a discussion on GitHub or reach out to the maintainers via an issue. We are happy to help.
