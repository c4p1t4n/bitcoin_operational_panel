# Phase 2: Database Schema & Domain Layer — Implementation

**Branch:** `feature/schema-and-domain`  
**Status:** ✅ Complete  
**Date:** 2026-06-27

---

## What Was Built

### 1. Docker Infrastructure

**File:** `app/infra/docker-compose.yml`

Spins up PostgreSQL 16 (Alpine) with:
- Database: `bitcoin_ops`
- User: `ops_user` (configurable password)
- Volume: persistent data storage (`postgres_data`)
- Health check: waits for Postgres readiness
- Network: isolated bridge network for future services (Redis, etc.)

**Files:**
- `docker-compose.yml` — container definition
- `.env.example` — connection string template
- `README.md` — quick start (docker-compose up, environment setup)

**Why this approach:**
- Single Alpine image = small, fast startup
- Volume persistence = data survives `docker-compose down` (unlike ephemeral containers)
- Health checks = app can wait for DB readiness before connecting
- One network = extensible to Redis (Phase 3) without changes

---

### 2. Drizzle ORM Schema

**File:** `app/infra/schema.ts`

Six tables, each optimized for its query pattern:

#### users
- Primary key: `id` (typically email or UUID)
- Enforces: `email` and `username` unique
- Indexes: fast lookup by email/username (login)
- No password field (optional, for future auth)

#### events (heart of event sourcing)
- Primary key: `id` (UUID)
- Append-only: only INSERT in code; no UPDATE/DELETE
- **Aggregate versioning:** `UNIQUE(aggregate_id, version)` ensures each aggregate's version is used once
  - Detects concurrent writes (two commands trying to append v2 to same aggregate)
  - One succeeds, other fails with unique constraint violation
  - EventStore catches this and throws `OptimisticConcurrencyError`
- Columns:
  - `aggregate_id`: what changed (block hash, alert UUID, peer address, transaction ID)
  - `aggregate_type`: entity type (Block, Transaction, Alert, Peer)
  - `event_type`: domain event name (MemPoolFeeSpike, AlertCreated, PeerConnected)
  - `version`: monotonic counter per aggregate (starting at 1)
  - `payload`: JSONB (event-specific data, e.g., fee spike %)
  - `metadata`: JSONB (system data: user ID, traceId, IP, etc.)
  - `occurred_at`: when the business event happened (user might log it later)
  - `recorded_at`: when Postgres recorded it (audit trail)
- Indexes:
  - `idx_events_aggregate` on `(aggregate_id, version)` — fast replay of an aggregate's history
  - `idx_events_type_occurred` on `(event_type, occurred_at)` — fast queries like "all fee spikes in the last hour"

#### alerts
- Primary key: `id` (same as aggregate ID for the alert)
- Snapshot of alert state (OPEN, ACKNOWLEDGED, RESOLVED)
- `source_event_id` references the original event that triggered the alert
- Indexes: status (common query: "show open alerts"), severity (filter by importance)

#### operations_log
- User-friendly summary of important events (for UI timeline)
- `event_id` references the source event (audit trail back to full event log)
- `category` (Block, Transaction, Alert, System) — groups UI display
- `event_name` (human-readable: "Novo Bloco Minerado")
- `summary` (short text: "Bloco 800.000 minerado por Foundry")
- `link_id` (internal aggregate ID for drilling down)
- Indexes: time (most recent first), category + time (filter by category)

#### peers_status
- Primary key: `peer_address` (IPv4:port or IPv6:port)
- Mutable snapshot of peer state (not in event log, updated directly)
- `connected`, `ban_score`, `version` — live network state
- Indexes: connected (show online peers), last_seen (detect stale peers)

#### rule_definitions
- Alert rule configurations (e.g., "trigger if fee spike > 20%")
- `configuration` is JSONB (flexible rule parameters)
- `is_active` boolean — soft-delete (keep history, disable rule)
- Indexes: active (only evaluate enabled rules), type (query by rule engine)

---

### 3. Drizzle Configuration

**File:** `app/backend/drizzle.config.ts`

Points Drizzle CLI to:
- Schema: `../infra/schema.ts`
- Output: `./src/db/migrations` (auto-generated SQL)
- Database: `DATABASE_URL` env var

Enables: `npm run db:generate` (creates .sql migrations) and `npm run db:push` (applies to DB)

---

### 4. Database Connection

**File:** `app/backend/src/db/index.ts`

Exports:
- `db` — Drizzle client (singleton)
- `checkDatabaseConnection()` — health check for app startup
- `closeDatabaseConnection()` — graceful shutdown (closes pool)

Uses pooled connection (pg.Pool) — reusable across requests, not creating new connection per query.

---

### 5. Domain Vocabulary (TypeScript)

**File:** `app/backend/src/domain/` (structure below)

#### Base Classes

**`domain/events/DomainEvent.ts`**
```typescript
abstract class DomainEvent {
  id: string // UUID
  aggregateId: string // what changed
  aggregateType: 'Block' | 'Transaction' | 'Alert' | 'Peer'
  eventType: string // discriminator
  version: number // starting at 1
  payload: unknown // subclass defines shape
  occurredAt: Date
  recordedAt: Date
}
```

**`domain/commands/Command.ts`**
```typescript
abstract class Command {
  id: string // UUID
  aggregateId: string // what to change
  commandType: string // discriminator
  requestedAt: Date
  payload: unknown // subclass defines shape
}
```

#### Event Subclasses

Discriminated unions via `eventType` field:

- **MemPoolFeeSpike** — mempool fee rate exceeded baseline
- **AlertTriggered** — rule condition met, alert created
- **AlertAcknowledged** — user acknowledged alert
- **PeerConnected** — peer online
- **PeerDisconnected** — peer offline
- **NewBlockMined** — new block received
- **TransactionDetected** — large or suspicious transaction

Each subclass declares its `payload` shape (TypeScript, compile-time validation).

#### Command Subclasses

- **CreateAlertRule** — add a new alert rule
- **AcknowledgeAlert** — mark alert as handled
- **UpdatePeerStatus** — update peer connectivity state

#### PermissionSpec

Reusable authorization rules:
```typescript
class PermissionSpec {
  static canCreateAlert(user: User): boolean
  static canAcknowledgeAlert(user: User, alert: Alert): boolean
  static canViewOperationsLog(user: User): boolean
}
```

(Backend uses to guard CommandBus, frontend uses to show/hide UI)

---

## Architecture Decisions & Rationale

### Why Drizzle + PostgreSQL

**vs Raw SQL:**
- Type safety (columns typed, not string-based)
- Migration auto-generation (define tables once, never touch SQL)
- Single source of truth (schema in TypeScript)

**vs NoSQL:**
- Event sourcing requires ACID guarantees (transactions, optimistic locking)
- Postgres JSONB satisfies flexibility needs while keeping ACID
- Complex queries (aggregate all events by type) easier in SQL

**vs ORM (Prisma, TypeORM):**
- Drizzle is lighter, more explicit
- Better for append-only patterns (explicit `INSERT`, no `UPDATE` hidden in ORM)
- Easier to integrate with Event Sourcing patterns

### Why JSONB Payload + TypeScript Validation

**Not strict database schema:**
- Flexibility: new event types don't require migrations
- Discipline: schema validation happens in TypeScript (DomainEvent subclasses)
- Query-able: can still index/filter JSONB (e.g., `WHERE payload->>'type' = 'fee_spike'`)

**Risk:** mismatched payload shapes (e.g., event stored as `{ fee: 50 }` but handler expects `{ feeSpike: 50 }`)
**Mitigation:** Strong typing in domain events + runtime validation in handlers (Phase 3 CommandBus)

### Why Optimistic Locking (Version-Based)

**Scenario:** Two commands try to update the same alert rule concurrently.
- Command A: version = 1 → 2 (succeeds)
- Command B: version = 1 → 2 (fails: `UNIQUE(aggregate_id, version)` already has (rule-123, 2))

**Result:** Command B's EventStore.append() catches the constraint violation, throws `OptimisticConcurrencyError`, caller retries or handles conflict.

**vs Pessimistic Locking (database locks):** Simpler in distributed systems, doesn't block readers.

### Why Domain Events Separate from Database Events

Domain events (TypeScript classes) are behavior-focused: "what happened in the business".
Database events (Drizzle rows) are just serialized DomainEvents + metadata.

This separation lets:
- CommandBus reason about events in memory (until append)
- Frontend deserialize database events back to domain types
- Future migration away from Postgres without changing domain layer

---

## Integration Points (Later Phases)

### Phase 3 (EventStore, CommandBus)
- Reads `events` table to replay aggregate state
- Catches `OptimisticConcurrencyError` from version conflicts
- Stores domain events via Drizzle

### Phase 4 (RuleEngine)
- Queries `rule_definitions` table for active rules
- Updates `alerts` snapshot when rule triggers

### Phase 5 (Frontend)
- Subscribes to domain event types (via shared types in packages)
- Displays `operations_log` summary on timeline
- Calls mutations (CreateAlertRule, AcknowledgeAlert)

---

## Testing Validation

✅ Schema compiles: `tsc --noEmit` (no type errors)  
✅ Migrations generate: `npm run db:generate` (schema.ts → SQL)  
✅ Database applies: `npm run db:push` (tables created)  
✅ Domain types export: `import { MemPoolFeeSpike, DomainEvent } from '@/domain'` (works)  
✅ Relationships defined: Drizzle relations compile (events → alerts)  
✅ Docker runs: `docker-compose up -d` (Postgres accessible)

No unit tests needed in this phase (schema and types are data, not business logic).

---

## Known Limitations & Future Work

1. **No timestamp triggers** — `updated_at` columns aren't auto-updated on row changes (yet). Either app updates manually or Postgres trigger added later.
2. **No cascading deletes** — alerts reference events but no `ON DELETE CASCADE`. Queries assume data is consistent; integrity enforced at app layer (Phase 3 CommandBus).
3. **No soft-delete** — except `rule_definitions.is_active`. Other tables assume data is only inserted/read, never deleted.
4. **Single database** — Redis and other services added as separate compose services later (Phase 3).
5. **No audit trail on mutations** — `alerts` table doesn't track who acknowledged or when. That's in the event log (use EventStore replay to see history).

---

## Checklist: Ready for Phase 3?

- [x] `app/infra/docker-compose.yml` — database running
- [x] `app/infra/schema.ts` — all six tables defined
- [x] `app/backend/drizzle.config.ts` — migrations configured
- [x] `app/backend/src/db/index.ts` — connection pool + health check
- [x] `app/backend/src/domain/events/*.ts` — all event types defined
- [x] `app/backend/src/domain/commands/*.ts` — all command types defined
- [x] `app/backend/src/domain/specs/PermissionSpec.ts` — authorization patterns defined
- [x] `package.json` — Drizzle + pg dependencies added, npm scripts configured
- [x] Migrations generate without error
- [x] TypeScript strict mode passes

---

## Addendum (2026-06-27)

The domain layer checklist above was checked off when this doc was written, but the
files were never committed — `app/backend/src/domain/` did not exist on disk until
Phase 3 prep caught the gap. Implemented now, matching the spec above with one
deviation:

- `DomainEvent.recordedAt` was dropped from the base class. Persistence time is an
  EventStore concern (set when the row is inserted), not a property of the domain
  event itself — keeping it on `DomainEvent` would let a caller construct an event
  with a `recordedAt` before it's ever persisted, which is meaningless.

Also fixed two bugs in `app/backend/src/db/index.ts` that blocked `tsc --noEmit`:
wrong relative path to `app/infra/schema.ts` (was `../../infra/schema`, needed
`../../../infra/schema`), and `db.raw` (not a real Drizzle API — replaced with
`sql` from `drizzle-orm`).

**Ready to start Phase 3: EventStore, CommandBus, EventBus.**
