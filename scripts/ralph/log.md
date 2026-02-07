# Ralph Agent Log

This file tracks what each agent run has completed. Append your changes below.

---

## 2026-02-06 - Rewrite Spike Scaffolding

**Task:** Initial TypeScript + Ink rewrite scaffolding and Phase 0 spikes

**Changes:**

- `apps/cli/src/app.tsx` - Ink TUI shell with virtual list and diff view
- `packages/ui/src/components/VirtualList.tsx` - Virtualized list with filtering and keybindings
- `packages/ui/src/components/DiffView.tsx` - Scrollable diff preview
- `benchmarks/virtual-list.bench.ts` - Tinybench perf harness

**Status:** Completed

**Notes:** Phase 0 spikes in place; remaining stories are provider, storage, and feature parity work.

---

## 2026-02-06 - GitHub Provider (TS)

**Task:** Phase 1 provider interface + GitHub PR listing

**Changes:**

- `packages/core/src/providers/*` - Provider interface and GitHub implementation
- `apps/cli/src/commands/prList.ts` - `lazyreview pr list` command
- `docs/ts-rewrite.md` - Usage notes for TS rewrite

**Status:** Implemented (not yet verified with live token)

**Notes:** Requires `LAZYREVIEW_TOKEN` to exercise GitHub API.

---

## 2026-02-06 - Provider Expansion + Auth/Config (TS)

**Task:** Extend provider support + auth/config CLI

**Changes:**

- `packages/core/src/providers/*` - GitLab, Bitbucket, Azure DevOps providers + factory
- `packages/core/src/config.ts` - YAML config loading/saving with defaults
- `packages/platform/src/secure-store.ts` - Keychain + encrypted file fallback
- `apps/cli/src/commands/auth.ts` - auth login/status/logout
- `apps/cli/src/commands/config.ts` - config show/path/edit
- `docs/ts-rewrite.md` - updated usage notes

**Status:** Implemented (needs runtime verification)

**Notes:** Azure DevOps expects repo format `org/project/repo` in PR list. Config loader now supports snake_case keys.
---

## 2026-02-06 - SQLite Storage + Offline Queue (TS)

**Task:** Phase 2 storage + queue scaffolding

**Changes:**

- `packages/storage/src/storage.ts` - SQLite storage with cache + queue tables
- `apps/cli/src/commands/queue.ts` - queue list/enqueue/sync commands
- `docs/ts-rewrite.md` - offline queue usage notes

**Status:** Implemented (needs runtime verification)

**Notes:** `queue sync` currently replays by deleting entries; provider wiring still pending.

---

## 2026-02-06 - Queue Replay (TS)

**Task:** Execute queued actions via provider APIs

**Changes:**

- `apps/cli/src/commands/queue.ts` - replay comment/approve/request changes/review
- `packages/core/src/providers/*` - comment/review methods (partial for Azure)
- `docs/ts-rewrite.md` - queue action types updated

**Status:** Implemented (Azure DevOps review actions pending)

---

## 2026-02-06 - Azure DevOps Reviews + Diff Placeholder (TS)

**Task:** Implement Azure DevOps review actions and diff placeholder

**Changes:**

- `packages/core/src/providers/azuredevops.ts` - diff via iterations/changes, vote API for approve/request changes, thread comments
- `docs/ts-rewrite.md` - Azure diff note

**Status:** Implemented (diff content still limited)

---

## 2026-02-06 - Theme Picker (TS)

**Task:** Add theme picker in TUI

**Changes:**

- `packages/ui/src/theme.ts` - theme definitions
- `apps/cli/src/app.tsx` - settings view with theme picker
- `docs/ts-rewrite.md` - theme usage notes

**Status:** Implemented (needs runtime verification)

---

## 2026-02-06 - Diff Worker Stub (TS)

**Task:** Offload large diff processing to worker thread

**Changes:**

- `apps/cli/src/utils/diffWorker.ts` - worker wrapper for large diffs
- `apps/cli/src/workers/diffWorker.ts` - worker implementation
- `apps/cli/src/app.tsx` - use worker for large diffs

**Status:** Implemented (needs runtime verification)

---

## 2026-02-06 - AI Summary + Review Preview (TS)

**Task:** Wire AI summary/review into diff view

**Changes:**

- `packages/core/src/ai/*` - AI client for OpenAI/Anthropic/Ollama
- `apps/cli/src/app.tsx` - AI summary/review preview with edit + post
- `docs/ts-rewrite.md` - AI usage notes

**Status:** Implemented (needs runtime verification)

---

## 2026-02-06 - PR Actions CLI (TS)

**Task:** Add CLI approve/request-changes/comment commands

**Changes:**

- `apps/cli/src/commands/prActions.ts` - approve/request-changes/comment helpers
- `apps/cli/src/index.ts` - pr approve/request-changes/comment commands
- `docs/ts-rewrite.md` - review action usage

**Status:** Implemented (needs runtime verification)

---

## 2026-02-06 - AI CLI (TS)

**Task:** Add AI login/logout/status commands

**Changes:**

- `packages/core/src/ai.ts` - AI key storage helpers
- `apps/cli/src/commands/ai.ts` - ai login/status/logout
- `docs/ts-rewrite.md` - AI command usage

**Status:** Implemented (AI review features pending)

---

## 2026-02-06 - TUI Live Data (TS)

**Task:** Wire TUI to provider list + cache

**Changes:**

- `apps/cli/src/app.tsx` - Live PR list fetch with cache + demo fallback
- `apps/cli/src/index.ts` - `start` accepts provider/repo
- `docs/ts-rewrite.md` - start usage notes

**Status:** Implemented (needs runtime verification)

**Notes:** Demo mode uses sample data when no repo is provided.

---

## 2026-02-06 - Diff Fetching (TS)

**Task:** Fetch diff from providers when available

**Changes:**

- `packages/core/src/providers/*` - Added getPullRequestDiff implementations
- `apps/cli/src/app.tsx` - Diff view loads provider diff with fallback
- `docs/ts-rewrite.md` - diff fetch notes

**Status:** Implemented (Azure DevOps diff pending)

---
