# Phase 2: Database Schema & Domain Layer — Review

**Branch:** `feature/schema-and-domain`  
**Review Date:** 2026-06-27  
**Status:** ✅ Ready for Phase 3

---

## SOLID Checklist

### S — Single Responsibility

| Module | Responsibility | Scope |
|--------|-----------------|-------|
| `app/infra/docker-compose.yml` | PostgreSQL runtime environment | Infrastructure only |
| `app/infra/schema.ts` | Data definition via Drizzle ORM | Schema, indexes, relationships |
| `app/backend/src/db/index.ts` | Database connectivity | Connection pool, health checks, graceful shutdown |
| `app/backend/src/domain/events/DomainEvent.ts` | Base class for domain events | Type definition, no persistence logic |
| `app/backend/src/domain/commands/Command.ts` | Base class for commands | Type definition, no dispatch logic |
| `app/backend/src/domain/specs/PermissionSpec.ts` | Authorization rules | Authorization checks only, no enforcement |

**Assessment:** ✅ Each module has one reason to change (schema schema, connection connection, types types).

**Risk:** None identified. Separation of concerns is clean.

---

### O — Open/Closed

| Scenario | Handled? | How |
|----------|----------|-----|
| Add new event type | ✅ Yes | Subclass DomainEvent, Drizzle allows new payloads via JSONB |
| Add new table | ✅ Yes | Extend schema.ts, regenerate migrations, app-level permissions stay unchanged |
| Add new rule type | ✅ Yes | New row in rule_definitions (no code change) |
| Change event payload shape | ⚠️ Careful | Backward compatibility relies on handlers validating payload (see Phase 3) |

**Assessment:** ✅ Open to extension (new events, tables, rules), mostly closed to modification.

**Risk:** JSONB payload flexibility without schema versioning. Mitigation: handlers must validate shape at runtime (Phase 3 CommandBus adds this).

---

### L — Liskov Substitution

| Pattern | Valid? |
|---------|--------|
| DomainEvent subclasses (MemPoolFeeSpike, AlertTriggered, etc.) | ✅ Yes — all have same interface, discriminated by eventType |
| Command subclasses (CreateAlertRule, AcknowledgeAlert, etc.) | ✅ Yes — all have same interface, discriminated by commandType |
| PermissionSpec static methods | ✅ Yes — all return boolean, same contract |

**Assessment:** ✅ Subtype contracts are honored (discriminated unions, homogeneous interfaces).

**Risk:** None identified.

---

### I — Interface Segregation

| Interface | Needed? |
|-----------|---------|
| DomainEvent base (id, aggregateId, payload, etc.) | ✅ Yes — all event types need these; not over-specific |
| Command base (id, aggregateId, payload, etc.) | ✅ Yes — all command types need these; not over-specific |
| PermissionSpec.canCreateAlert(user) | ✅ Yes — checks user role, doesn't assume auth backend |
| db client export | ✅ Yes — app-level, one export per service (Drizzle instance) |

**Assessment:** ✅ Interfaces are cohesive (don't force implementations to depend on unused methods).

**Risk:** None identified.

---

### D — Dependency Inversion

| Dependency | Inverted? | How |
|------------|-----------|-----|
| CommandBus depends on EventStore | Will be (Phase 3) | EventStore injected at CommandBus construction |
| EventStore depends on database | ✅ Yes | db client injected (not hardcoded) |
| EventStore depends on EventBus | Will be (Phase 3) | EventBus injected at EventStore construction |
| PermissionSpec used by CommandBus | Will be (Phase 3) | CommandBus calls PermissionSpec.can*() (static, no injection needed) |

**Assessment:** ✅ Dependencies flow inward (high-level CommandBus depends on abstractions, not concrete database).

**Risk:** Phase 3 must inject EventStore into CommandBus correctly (dependency wiring). Mitigated by explicit constructor injection (not service locator).

---

## Architecture Trade-offs & Alternatives

### Trade-off 1: Drizzle ORM vs Raw SQL

| Aspect | Drizzle | Raw SQL |
|--------|---------|---------|
| Type safety | ✅ Strong (columns typed at compile time) | ❌ Weak (strings, runtime errors) |
| Migration generation | ✅ Auto (schema.ts → SQL) | ❌ Manual .sql files |
| Refactoring | ✅ Easy (rename column → IDE refactor everywhere) | ❌ Hard (grep/replace, error-prone) |
| Performance | ✅ Same (compiles to same SQL) | ✅ Same |
| Learning curve | ⚠️ New DSL | ✅ Standard SQL |

**Decision:** Drizzle chosen.  
**Rationale:** Type safety and auto-migration outweigh raw SQL simplicity for a long-lived codebase.  
**Fallback:** If Drizzle becomes unmaintained, raw SQL is one layer away (drop Drizzle, write queries manually).

---

### Trade-off 2: JSONB Payload + TypeScript Validation vs Strict Database Schema

| Aspect | JSONB + TS | Strict Schema |
|--------|-----------|--------------|
| Flexibility | ✅ High (new event type = no migration) | ❌ Low (schema change requires migration) |
| Type safety | ✅ Good (TypeScript DomainEvent subclasses) | ✅✅ Excellent (database enforces) |
| Query-ability | ✅ Good (can index JSONB, filter by →'key') | ✅ Same |
| Compatibility | ⚠️ Risk (mismatched payload shapes) | ✅ Safe (database rejects invalid data) |

**Decision:** JSONB + TypeScript validation chosen.  
**Rationale:** Iteration speed matters early. Handlers validate at runtime (Phase 3 CommandBus).  
**Fallback:** Add Postgres CHECK constraints or JSON schema validation if errors accumulate.

---

### Trade-off 3: Optimistic Locking (Version-Based) vs Pessimistic (Database Locks)

| Aspect | Optimistic | Pessimistic |
|--------|-----------|------------|
| Concurrency (readers) | ✅ High (readers not blocked) | ❌ Low (lock blocks readers) |
| Concurrency (writers) | ⚠️ Medium (conflicts detected post-fact) | ✅ High (exclusive lock) |
| Retry logic | ⚠️ Caller must retry | ✅ Automatic (wait for lock) |
| Distributed systems | ✅ Good (no network round-trip for lock) | ❌ Hard (lock state across machines) |

**Decision:** Optimistic locking via version chosen.  
**Rationale:** Event sourcing assumes write conflicts are rare. Readers (analytics, UI) outnumber writers.  
**Fallback:** Phase 3 CommandBus implements retry logic; if conflicts spike, switch to pessimistic with backoff.

---

### Trade-off 4: Single PostgreSQL Container vs Separate Infrastructure

| Aspect | Docker Compose | Separate Services |
|--------|----------------|-------------------|
| Local dev | ✅ Simple (one command) | ❌ Complex (manual setup) |
| CI/production parity | ✅ High (same container) | ⚠️ Medium (must match Docker) |
| Dependencies (Redis, etc.) | ⚠️ Single file gets crowded | ⚠️ Same issue |
| Scaling | ✅ Easy (replicate compose config) | ✅ Same |

**Decision:** Single docker-compose.yml with PostgreSQL chosen.  
**Rationale:** Early development, fast feedback. Redis added as separate service in Phase 3 without disruption.  
**Fallback:** Production uses managed Postgres (AWS RDS, etc.); docker-compose is dev/staging only.

---

## Known Limitations

### 1. No Timestamp Triggers

`alerts.updated_at` and other timestamp columns are not auto-updated on mutation.

**Impact:** If an alert is acknowledged but no new event is persisted, `updated_at` stays stale.  
**Mitigation (Phase 3):** CommandBus updates timestamps on mutation (before persist).  
**Future:** Add Postgres trigger: `BEFORE UPDATE ON alerts SET updated_at = now()`

### 2. No Cascading Deletes

`alerts.source_event_id` references `events.id`, but no `ON DELETE CASCADE`.

**Impact:** If an event is deleted (shouldn't happen, but if), orphaned alerts remain.  
**Mitigation:** Append-only constraint (no DELETE on events). Alerts can only be soft-deleted via `status` field.  
**Future:** Add constraint in migration if delete becomes possible.

### 3. JSONB Payload Not Validated

Database doesn't enforce payload shape (e.g., `fee_spike` is a number).

**Impact:** Malformed payloads can be inserted, handlers crash at runtime.  
**Mitigation (Phase 3):** CommandBus validates domain event payload before EventStore.append.  
**Future:** Add Postgres JSON schema validation (requires PostgreSQL 10+, available but not yet used).

### 4. Single Database Connection String

One `DATABASE_URL` for all phases (app, tests, migrations).

**Impact:** Tests run against production database if env not overridden.  
**Mitigation:** `drizzle.config.ts` reads from `.env` (app/infra/), which is dev-only. CI uses different env.  
**Future:** Separate test database in CI setup.

### 5. No Row-Level Security (RLS)

Database doesn't enforce role-based access (e.g., user A can't read user B's alerts).

**Impact:** App must validate permissions before every query.  
**Mitigation (Phase 3):** CommandBus + PermissionSpec validate access.  
**Future:** Enable Postgres RLS policies for defense-in-depth.

---

## Integration Checklist: Ready for Phase 3?

| Item | Status | Notes |
|------|--------|-------|
| Docker PostgreSQL runs | ✅ | `docker-compose up -d` confirmed |
| Schema applies to database | ✅ | All 6 tables created, indexes applied |
| TypeScript strict mode passes | ✅ | `tsc --noEmit` clean |
| Domain types compile | ✅ | DomainEvent, Command, PermissionSpec exported |
| Drizzle client ready | ✅ | db singleton + health check available |
| Package.json dependencies | ✅ | pg, drizzle-orm, drizzle-kit installed |
| npm scripts configured | ✅ | db:generate, db:push, db:up, db:down ready |
| No merge conflicts | ✅ | feature/schema-and-domain clean from main |
| Documentation complete | ✅ | plan.md, implementation.md, review.md written |

**Verdict:** ✅ **Phase 2 Complete. Ready for Phase 3.**

---

## What Phase 3 Requires

### Must Exist
- ✅ `events` table (EventStore will append here)
- ✅ `DomainEvent`, `Command` base types (CommandBus will instantiate subclasses)
- ✅ `db` client (EventStore will query/insert)
- ✅ `PermissionSpec` (CommandBus will check permissions)

### Must NOT Exist Yet
- ❌ EventStore (Phase 3 builds it)
- ❌ CommandBus (Phase 3 builds it)
- ❌ EventBus (Phase 3 builds it)
- ❌ RuleEngine (Phase 4)

**Phase 3 starts here:** EventStore.ts reads/writes events, CommandBus dispatches commands, EventBus publishes.

---

## Handoff Notes

- Database is running in docker-compose; connection string in `.env.example`
- Schema is locked (no changes without migration + review)
- Domain types are open to extension (new event/command subclasses welcome)
- PermissionSpec is a placeholder; Phase 5 will add real RBAC
- Phase 3 MUST implement payload validation in CommandBus (mitigates JSONB risk)

**Next deliverable:** EventStore.ts with optimistic locking, comprehensive tests.
