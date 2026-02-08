# Research App — Quick Reference Checklist

Use this checklist to ensure all research steps are completed.

## Pre-Research
- [ ] Resolved project path from argument
- [ ] Verified directory exists
- [ ] Checked if git repository

## Documentation Scan
- [ ] CLAUDE.md (root or .claude/)
- [ ] README.md
- [ ] timeline.md / PROJECT_LOG.md
- [ ] AGENTS.md
- [ ] .claude/docs/ contents
- [ ] .claude/skills/SKILLS_REGISTRY.md
- [ ] Dependency file (package.json, Gemfile, pyproject.toml, etc.)

## Codebase Analysis
- [ ] Directory overview (ls -la)
- [ ] File counts by extension
- [ ] Directory tree (2-3 levels)
- [ ] Total size (excluding node_modules, .git, dist, build)
- [ ] Primary language identification
- [ ] Source vs config vs docs categorization

## Dependency Analysis
- [ ] Production dependencies listed with versions
- [ ] Dev dependencies listed
- [ ] Package manager identified
- [ ] Outdated/deprecated deps flagged

## Architecture Analysis
- [ ] Design patterns identified
- [ ] Key components mapped (name, location, purpose, size)
- [ ] API framework identified
- [ ] Database and ORM identified
- [ ] Background job system identified
- [ ] Frontend state management identified
- [ ] Test infrastructure mapped

## Git History
- [ ] Total commit count
- [ ] First and last commit dates
- [ ] Recent 10 commits listed
- [ ] Top contributors listed
- [ ] Active branches listed

## Feature Inventory
- [ ] Routes/endpoints mapped
- [ ] Data models/entities cataloged
- [ ] Features grouped by category
- [ ] Each feature: name, description, files, endpoints, status

## Documentation Quality
- [ ] Scored against Tier 1/2/3 requirements
- [ ] Each CLAUDE.md section: Present (Y/N), Quality
- [ ] Gaps identified

## Recommendations
- [ ] Immediate priorities listed
- [ ] Short-term improvements listed
- [ ] Long-term suggestions listed

## Report
- [ ] Report written using report-template.md format
- [ ] Saved to /Apps/docs/reports/<project>-research-<date>.md
- [ ] Summary presented to user
