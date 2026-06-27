# Phase 2: Database Schema & Domain Layer — Plan

**Branch:** `feature/schema-and-domain`  
**Scope:** PostgreSQL infrastructure, Drizzle ORM schema, domain event/command types, EventStore foundation  
**Order:** Mandatory first phase after Bitcoin node integration. EventStore, CommandBus, and EventBus all depend on this.

---

## Why This Phase

The system needs a persistent, append-only event log and domain vocabulary before implementing business logic. Without schema and domain types, there's nowhere to store events, no type-safe way to describe what happened in the system, and no foundation for event sourcing.

---

## Scope: What Gets Built

### 1. Docker Infrastructure (`app/infra/`)

**Files:**
- `docker-compose.yml` — PostgreSQL 16 container with persistent volume, health checks, network isolation
- `.env.example` — connection string template
- `README.md` — quick start guide

**Why Docker:** Local development identical to CI/production. No "works on my machine" surprises.

**Key decisions:**
- PostgreSQL 16 (Alpine) for small image, latest stable
- Single-container setup (Redis added later, separate compose service)
- Volume persistence so data survives `docker-compose down`
- Health checks so app can wait for DB readiness

---

### 2. Drizzle ORM Schema (`app/infra/schema.ts`, migrations)

**Tables:**

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `users` | Application users with RBAC | `id` (email), `role`, `username`, `password_hash` |
| `events` | Immutable append-only event log | `id`, `aggregate_id`, `aggregate_type`, `event_type`, `version`, `payload`, `metadata` |
| `alerts` | Alert state snapshots | `id`, `type`, `status`, `severity`, `source_event_id` |
| `operations_log` | User-friendly event summaries for UI | `id`, `event_id`, `category`, `event_name`, `summary`, `link_id` |
| `peers_status` | Bitcoin network peer connectivity | `peer_address`, `version`, `ban_score`, `connected`, `last_seen` |
| `rule_definitions` | Alert rule configurations | `id`, `name`, `rule_type`, `configuration` (JSONB) |

**Why Drizzle:**
- Type-safe queries (vs raw SQL)
- Auto-generated migrations (vs manual .sql files)
- Relationships defined in code (easier refactoring)
- Integrates with TypeScript without ceremony

**Key decisions:**

- **events table:**
  - Append-only: no UPDATE/DELETE constraints in code (can be enforced in Postgres via role permissions later)
  - `version` column + `UNIQUE(aggregate_id, version)` for optimistic locking
  - `payload` and `metadata` as JSONB for flexibility (schema validation happens in TypeScript)
  - Indexes on `(aggregate_id, version)` and `(event_type, occurred_at)` for common queries

- **Optimistic locking:**
  - Each aggregate (alert, block, peer) has independent version counters
  - EventStore checks: "if version is not what I expected, another command won the race"
  - Prevents lost writes in concurrent scenarios

- **JSONB payload:**
  - No schema enforcement in the database (flexibility, but discipline required)
  - Schema validation happens in TypeScript (DomainEvent subclasses)
  - Queries can still filter/index JSONB (e.g., `WHERE payload->>'type' = 'fee_spike'`)

---

### 3. Domain Vocabulary (`app/backend/src/domain/`)

**Base types (TypeScript, no persistence):**

```typescript
// events/DomainEvent.ts
abstract class DomainEvent {
  id: string
  aggregateId: string
  aggregateType: 'Block' | 'Transaction' | 'Alert' | 'Peer'
  eventType: string
  version: number
  payload: unknown
  occurredAt: Date
  recordedAt: Date
}

// Subclasses define payload types
class MemPoolFeeSpike extends DomainEvent {
  eventType = 'MemPoolFeeSpike'
  declare payload: {
    feeSpike: number // percentage above baseline
    medianFee: number
    baselineFee: number
    txCount: number
  }
}

class AlertTriggered extends DomainEvent {
  eventType = 'AlertTriggered'
  declare payload: {
    alertId: string
    ruleId: string
    severity: 'HIGH' | 'MEDIUM' | 'LOW'
    message: string
  }
}
```

**Commands (describe intended actions):**

```typescript
// commands/Command.ts
abstract class Command {
  id: string
  aggregateId: string
  commandType: string
  requestedAt: Date
}

// Subclasses
class CreateAlertRule extends Command {
  declare payload: {
    name: string
    ruleType: string
    config: Record<string, unknown>
  }
}

class AcknowledgeAlert extends Command {
  declare payload: {
    alertId: string
    acknowledgedBy: string
  }
}
```

**PermissionSpec (reusable authorization rules):**

```typescript
class PermissionSpec {
  static canCreateAlert(user: User): boolean
  static canAcknowledgeAlert(user: User, alert: Alert): boolean
  static canViewOperationsLog(user: User): boolean
}
```

**Why TypeScript-first:**
- Types drive the domain model (not an afterthought)
- Discriminated unions enable type-safe event handlers
- Frontend shares these types via package exports

---

### 4. Database Connection (`app/backend/src/db/`)

**Files:**
- `index.ts` — Drizzle client + pool + health check
- `drizzle.config.ts` — migration configuration

**Why separate from schema:**
- Schema is data definition (in `app/infra/` shared location)
- Client is runtime connection (backend-only)
- Migrations can be auto-generated and run independently

---

## What Stays Out of Scope

- **EventStore.ts** — event persistence logic (Phase 2b, depends on schema existing)
- **CommandBus, EventBus** — dispatch and pub/sub (Phase 3)
- **RuleEngine** — alert evaluation (Phase 4)
- **Frontend integration** — frontend stays on main, doesn't merge this phase yet

---

## Testing Strategy

No unit tests in this phase (schema and types are data, not behavior). Validation:
- Drizzle migrations generate without errors: `npm run db:generate`
- TypeScript compiles: `tsc --noEmit`
- Schema applies to running database: `npm run db:push`
- Domain types are discriminated unions (type-safe at compile time, no runtime tests needed)

---

## Known Decisions & Trade-offs

| Decision | Rationale | Risk |
|----------|-----------|------|
| JSONB payload, not strict schema | Flexibility, faster iteration | Must validate in TypeScript; no DB-level constraints |
| Optimistic locking via version | Detects concurrent writes | Caller must handle `OptimisticConcurrencyError` (Phase 3 CommandBus) |
| Drizzle instead of raw SQL | Type safety, auto-migrations | Slightly heavier than vanilla pg driver |
| Single PostgreSQL container | Simple local dev | Need separate Redis service later; production will differ |
| Domain types in TypeScript | Single source of truth | Can't share with non-TS backend (not a concern here) |

---

## Files Checklist

### Create
- [ ] `app/infra/docker-compose.yml`
- [ ] `app/infra/.env.example`
- [ ] `app/infra/README.md`
- [ ] `app/infra/schema.ts` (Drizzle tables + relationships)
- [ ] `app/backend/drizzle.config.ts`
- [ ] `app/backend/src/db/index.ts` (Drizzle client)
- [ ] `app/backend/src/domain/index.ts` (exports)
- [ ] `app/backend/src/domain/events/DomainEvent.ts`
- [ ] `app/backend/src/domain/events/MemPoolFeeSpike.ts`
- [ ] `app/backend/src/domain/events/AlertTriggered.ts`
- [ ] `app/backend/src/domain/events/PeerConnected.ts`
- [ ] `app/backend/src/domain/events/PeerDisconnected.ts`
- [ ] `app/backend/src/domain/events/NewBlockMined.ts`
- [ ] `app/backend/src/domain/commands/Command.ts`
- [ ] `app/backend/src/domain/commands/CreateAlertRule.ts`
- [ ] `app/backend/src/domain/commands/AcknowledgeAlert.ts`
- [ ] `app/backend/src/domain/specs/PermissionSpec.ts`

### Update
- [ ] `app/backend/package.json` — add Drizzle + pg dependencies, db scripts
- [ ] `app/backend/tsconfig.json` — if needed (strict mode likely already set)
- [ ] `docs/index.md` — mark Phase 2 as in-progress
- [ ] `docs/next_steps.md` — once complete, update Phase 2 status

---

## How to Verify Completion

1. ✅ Docker: `docker-compose up -d` in `app/infra/` → postgres container runs
2. ✅ Database: Connect via `psql -h localhost -U ops_user -d bitcoin_ops` → tables exist
3. ✅ TypeScript: `tsc --noEmit` from backend → zero errors
4. ✅ Migrations: `npm run db:generate && npm run db:push` → no errors
5. ✅ Domain types: import from `app/backend/src/domain/` → all exports available, discriminated unions type-check
6. ✅ Schema relationships: Drizzle relations compile (events → alerts, alerts → rules)

---

## Next Phase Dependency

Phase 3 (EventStore, CommandBus, EventBus) **requires** this phase complete:
- EventStore needs `events` table to persist
- CommandBus needs `DomainEvent` and `Command` types
- Domain types need to be shareable (with frontend in Phase 5)

If this phase is incomplete, Phase 3 cannot proceed.
