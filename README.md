# Pulse

Pulse is a minimal realtime-chat-style application used as a **debugging sandbox** within the WorkSim platform. It demonstrates a small messaging core (server-authoritative ordering, optimistic sends, unread tracking, reconnect backfill) with intentional, documented bugs planted for candidate learning and assessment.

## Overview

**What it is:** A lightweight Next.js app with:
- A pure, deterministic realtime-chat core (`src/lib/chat.ts`) — no wall clock, no real timers, no real sockets; sequence numbers, cursors, and focus state are always passed in explicitly
- Server-authoritative message ordering with optimistic-echo reconciliation and duplicate prevention
- Per-channel unread counts that suppress increments for the currently focused channel
- A reconnect-backfill cursor that fills exactly the gap missed during an outage, with no duplicates
- Intentional seeded bugs (via patches) that candidates must fix

**What it's for:** WorkSim uses Pulse to test problem-solving skills across common realtime-chat edge cases — ordering under race conditions, state invalidation tied to UI focus, and gap-free recovery after a dropped connection.

**Key constraint:** This is a standalone template repo. `main` here is the correct, unmodified baseline implementation. At provision time, the platform plants every bug in the sprint into a student's own copy of the repo's root commit — so while this template's `main` stays clean, a student's `main` carries all of the sprint's known defects from the start. The assigned ticket names the one in scope; unrelated failures are other tickets' bugs, not something to fix.

## Quick Start

### Prerequisites
- Node.js 24+
- npm or yarn

### Installation & Development

```bash
# Install dependencies
npm install

# Run dev server (http://localhost:3000)
npm run dev

# Run all tests (visible + grading)
npm test

# Run only grading tests (authoritative test suite)
npm run test:grading

# Build for production
npm run build
```

## Project Structure

```
pulse/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Channel view (facade over seed messages)
│   └── lib/
│       ├── chat.ts              # Chat core (ordering/reconcile, unread, backfill)
│       └── _smoke.ts            # Smoke test data + static seed messages
├── tests/
│   ├── visible/                 # VISIBLE tests (develop against these)
│   │   ├── _smoke.test.ts       # Basic app smoke test
│   │   └── chat.test.ts         # Happy-path chat workflow tests
│   └── grading/                 # GRADING tests (restored from baseline in CI)
│       ├── message-ordering.test.ts     # Server-authoritative order + reconciliation
│       ├── unread-count-focus.test.ts   # Focused-channel suppression + reset on open
│       └── reconnect-backfill.test.ts   # Gap-free, dedupe, ordered backfill on reconnect
├── .github/workflows/
│   └── grade.yml                # CI grading workflow
├── package.json
├── tsconfig.json
├── next.config.ts
└── vitest.config.ts
```

## The `chat.ts` API

Everything is deterministic: no `Date.now()`, no real timers, no real sockets. Sequence numbers (`seq`), cursors (`lastSeenSeq`), and focus (`focusedChannelId`) are always explicit arguments.

### Messages + ordering

- `createOptimisticMessage(input)` — builds the pending local echo for a just-sent message (`seq: null`, `id` temporarily equals `clientId`).
- `confirmMessage(optimistic, serverAssigned)` — produces the server-confirmed version (`id`/`seq` from the server) of a previously-optimistic message.
- `reconcileIncoming(messages, incoming)` — merges one incoming message into the list:
  - Same `clientId` already present → **replaced in place** (the optimistic echo is reconciled, never duplicated).
  - Same `id` already present (no `clientId` match) → **no-op** (duplicate delivery dropped).
  - Otherwise → appended.
  - The result is always re-sorted by server `seq` (pending/`null`-seq messages sort after all confirmed ones), so out-of-order network arrival never affects display order.

### Unread counts

- `createUnreadState()` — `{ unread: {} }`.
- `applyIncoming(state, msg, focusedChannelId)` — increments `msg.channelId`'s unread count by 1, **unless** `msg.channelId === focusedChannelId`, in which case the state is returned unchanged.
- `openChannel(state, channelId)` — resets that channel's unread count to `0`.

### Reconnect backfill

- `createBackfillState()` — `{ messages: [], lastSeenSeq: 0 }`.
- `backfillOnReconnect(state, serverMessages)` — appends every message in `serverMessages` with `seq > state.lastSeenSeq` (the gap missed while disconnected), sorted by `seq`, deduped against already-known ids, and advances `lastSeenSeq` to the new maximum. Returns `state` unchanged if there's nothing new.

**Design decision — explicit cursors/focus as arguments, not read from a store:** every function takes exactly the state it needs as a plain argument and returns a new plain value. This keeps every scenario (racing seq arrivals, a channel becoming focused mid-stream, a multi-message gap across a reconnect) fully reproducible in a test with no mocking of clocks, sockets, or timers — the same discipline `posts.ts` (Quillio) and `cart.ts`/`money.ts` (ShopForge) use.

## Testing Strategy

Pulse uses the same **two-tier test split** as Quillio and ShopForge:

### Visible Tests (`tests/visible/`)
- **Purpose:** For candidates to develop and validate their fixes
- **Run:** `npm test` (includes both visible + grading)
- **Edit:** Safe to edit and experiment with

### Grading Tests (`tests/grading/`)
- **Purpose:** Authoritative test suite for final assessment
- **Run:** `npm run test:grading` or included in full test run
- **Edit:** Do not edit — these are restored from the baseline in CI
- **Coverage:** One file per seeded bug
  - `message-ordering.test.ts` — server-authoritative order under out-of-order arrival, optimistic-echo reconciliation into correct position, no duplicate on confirmation, duplicate delivery dropped
  - `unread-count-focus.test.ts` — focused channel suppresses increments, `openChannel` resets to 0, background channels still accumulate
  - `reconnect-backfill.test.ts` — gap-free backfill across multiple reconnects, no duplicates on re-report, ordering preserved across the reconnect boundary, no-op when nothing new

**This template repo's own `main` is the correct baseline.** A student's provisioned repo ships with the sprint's known defects already committed to `main`; the assigned ticket names the one in scope, and unrelated test failures are other tickets' bugs, not something to fix.

## CI Grading Workflow

The `.github/workflows/grade.yml` workflow runs on every pull request targeting `main`:

1. Checks out the PR's merge ref (candidate code + grading baseline merged)
2. Restores `tests/grading`, `package.json`, and `vitest.config.ts` from the base branch — so a PR cannot fake a pass by editing those files
3. Installs dependencies with `npm ci`
4. Runs `npm run test:grading`

**Threat model (accurate):** Restoring grading tests and config from the base branch prevents a candidate PR from altering what gets tested or how. However, because GitHub runs the workflow file from the PR's merge ref, a collaborator with write access could still alter `grade.yml` itself. For this reason, **WorkSim grades authoritatively out-of-band and does not solely trust the in-repo check**.

## Environment Variables

Pulse uses no external APIs or environment variables. All data is in-memory arrays for determinism (see `src/lib/_smoke.ts` for the static seed messages used by the facade page).

## Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Vitest Docs:** https://vitest.dev
- **React Docs:** https://react.dev
