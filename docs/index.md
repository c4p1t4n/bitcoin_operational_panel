# Bitcoin Operations Panel — Implementation Index

## Completed (✅)

### Adapter Layer
- ✅ **bitcoin.types.ts** — Strong types for RPC responses (BlockchainInfo, MempoolInfo, MempoolEntry, FeeEstimate, JSON-RPC envelope)
- ✅ **BitcoinRPCAdapter.ts** — Adapter pattern isolating HTTP JSON-RPC transport behind `BitcoinRPCClient` interface; `BitcoinRPCError` for typed error handling
- ✅ **BasePoller.ts** — Template Method base class for polling cycle (start/stop/no-overlap scheduling); reusable by MempoolPoller and future BlockWatcher
- ✅ **MempoolPoller.ts** — Observer that diffs mempool snapshots and emits `tx:added`, `tx:removed`, `fee:spike`, `poll:error`

### Tooling & Validation
- ✅ **app/backend/package.json** — Workspace manifest (ESM, vitest, tsx, typescript, dotenv)
- ✅ **app/backend/tsconfig.json** — ES2022 target, Bundler resolution, strict mode, `types: ["node"]`
- ✅ **app/backend/.env.example** — RPC connection template
- ✅ **scripts/watch-mempool.ts** — Manual wiring demo (connects adapter + poller, prints events to console)

### Documentation
- ✅ **docs/features/bitcoin-node-integration/plan.md** — Scope, interfaces, design decisions, test plan
- ✅ **docs/features/bitcoin-node-integration/implementation.md** — What was built and why
- ✅ **docs/features/bitcoin-node-integration/review.md** — SOLID checklist, known trade-offs, next steps

### Testing & Validation
- ✅ Typecheck: `tsc --noEmit` clean
- ✅ Live validation: `scripts/watch-mempool.ts` ran against real node (Bitcoin Core 24.0.1, pruned) with no errors
- ✅ Typed probe: confirmed RPC response shapes match implementation

**Status:** First vertical slice complete on `feature/bitcoin-node-integration` branch. Validated against real Bitcoin node. Mempool empty (node mid-IBD) — re-verify `tx:added`/`fee:spike` once node is synced.

---

## Next Steps (TODO)

Follow the mandatory order per the architecture roadmap:

### Phase 2: Database Schema & Domain Layer

1. **schema.ts** — Drizzle ORM + Postgres
   - `events` table: append-only (no UPDATE, DELETE) log of all domain events
   - `alertRules` table: configuration for alert conditions
   - Migrations wiring
   - Permissions enforced in Postgres if desired (SELECT-only for append-only guarantee)

2. **domain/index.ts** — Core business logic
   - `DomainEvent` base class (eventId, timestamp, type, payload)
   - Event subclasses: `MemPoolFeeSpike`, `LargeTxDetected`, `NewBlockMined`, `AlertTriggered`
   - `Command` base class (commandId, aggregateId, type)
   - Command subclasses: `AcknowledgeAlert`, `CreateAlertRule`
   - `PermissionSpec` — Specification pattern for access control (reusable server + frontend)

3. **EventStore.ts** — Event sourcing heart
   - `append(command, events)` — persists events with optimistic locking via version/OptimisticConcurrencyError
   - `getEventsFor(aggregateId)` — reconstructs state by replaying events
   - Handles the CommandBus → EventStore → EventBus publish flow

### Phase 3: Command & Event Bus

4. **CommandBus.ts** — Command dispatch and routing
   - `dispatch(command)` → find handler → execute → emit domain events
   - Handlers registered at boot (dependency injection)

5. **EventBus.ts** — Pub/Sub via Redis, fan-out of domain events
   - Listens to EventStore.append, publishes to subscribers
   - Used by AlertRuleBuilder, frontend subscriptions, audit trail

### Phase 4: Rule Engine

6. **RuleEngine.ts** — Chain of Responsibility + Strategy
   - Evaluates domain events against alert rules
   - Each condition type (fee spike, tx size, RBF) is a Strategy handler
   - `AlertRuleBuilder` — fluent API for building rules

### Phase 5: Backend API & Frontend Integration

7. **alerts.router.ts** — tRPC router
   - Decorator pattern via middleware (auth, audit, rate-limit)
   - Mutations: createAlertRule, acknowledgeAlert
   - Subscriptions: onBitcoinNetworkEvent (tRPC + Redis Pub/Sub + WebSocket)

8. **frontend/store/WebSocketStore.ts** — External store (not React state)
   - `useSyncExternalStore` + EventEmitter pattern
   - Reconnection, backpressure handling

9. **frontend/components/** — React components
   - OperationsTable (render props pattern)
   - AlertPanel (compound component)
   - EventTimeline (reconstructs state from event log)
   - MempoolWidget (real-time metrics)
   - PresenceAvatars (who's online)

---

## Architecture Reminders

- **Order matters:** later phases assume earlier phases exist
- **SRP:** each class has one reason to change (adapter doesn't persist, poller doesn't notify, etc.)
- **SOLID:** checked on every file; see `.skills/feature/references/solid-constraints.md`
- **Testing:** unit tests written (not executed) per phase; see `.skills/feature/SKILL.md`
- **Patterns are concrete:** not decorative — each one solves a real problem in this codebase

---

## How to Read This

- **New to the project?** Start with completed `bitcoin.types.ts` + `BitcoinRPCAdapter.ts` (10 min each, real data), then `MempoolPoller.ts` (see live events). These are the "tangible proof it works" phase.
- **Ready to extend?** Pick the next TODO phase, create `feature/{name}` off `main`, and follow `.skills/feature/SKILL.md` workflow.
- **Reviewing code?** Each file's `@module` header explains the pattern and responsibility; see `review.md` for SOLID checklist; see `plan.md` for design decisions.
