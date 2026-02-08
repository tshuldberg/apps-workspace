# Timeline Entry Template

Use this format for `timeline.md` entries in any project.

---

```markdown
### YYYY-MM-DD: Entry Title (commit_hash) [STATUS]

**What was completed:**
1. **Section** — details of what was done
2. **Section** — details of what was done

**Files Created/Modified/Deleted:**
- `path/to/file` — description of change
- `path/to/file` — description of change

**Verification:**
- [command run] — [result]

**Next Steps:**
- [ ] Pending item
- [ ] Pending item
```

---

## Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| Date | Yes | ISO date (YYYY-MM-DD) |
| Title | Yes | Brief description of the session's work |
| Commit hash | If applicable | Git commit hash for the changes |
| Status | Yes | COMPLETE, IN PROGRESS, BLOCKED |
| What was completed | Yes | Numbered list of accomplishments |
| Files changed | Yes | List of files with descriptions |
| Verification | Recommended | Commands run to validate the work |
| Next Steps | Yes | What remains to be done |
