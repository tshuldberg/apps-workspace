# MyMail Design

## Product Identity

MyMail is a privacy-first local email client module for the MyLife hub. Manages multiple email accounts, message organization with folders, draft composition, search, and threading. All data stored locally in SQLite with zero cloud dependency for core functionality.

## Core Features

- Multi-account management (IMAP/SMTP configuration)
- Inbox with folder organization (inbox, sent, drafts, trash, archive, spam)
- Message compose and draft management
- Star/flag messages for quick access
- Full-text search across subject, from, and body
- Thread grouping by normalized subject
- Read/unread tracking
- Per-folder message counts and stats
- Date range filtering

## Architecture

- Hub module: `modules/mail/` with `ml_` table prefix
- 4 SQLite tables: accounts, messages, drafts, folders
- Pure search engine: case-insensitive substring matching, thread grouping, date filtering
- All data on-device, privacy-first
