# bitcoin-node-integration — Implementação

**Branch:** `feature/bitcoin-node-integration`
**Data:** 2026-06-27
**Status:** Implementado (sem testes automatizados — ver Desvios do plano)

---

## Arquivos criados

### `package.json` (raiz)

**Responsabilidade:** root de npm workspaces.
**Pattern aplicado:** nenhum — configuração de monorepo.
**Mudança:** removidos `@trpc/client`, `@trpc/server` e `vite`, que estavam soltos na
raiz sem pertencer a workspace nenhum. Voltam nos `package.json` corretos quando as
features de tRPC e frontend existirem.

### `app/backend/package.json`, `app/backend/tsconfig.json`

**Responsabilidade:** manifesto e config TS do workspace backend (ESM, `moduleResolution: Bundler`).
**Dependências:** `dotenv` (runtime); `typescript`, `tsx`, `vitest`, `@types/node` (dev).

### `app/backend/src/bitcoin/bitcoin.types.ts`

**Responsabilidade:** tipos fortes para as respostas RPC usadas (`BlockchainInfo`,
`MempoolInfo`, `MempoolEntry`, `FeeEstimate`, envelope JSON-RPC).
**Pattern aplicado:** nenhum — são tipos puros, sem lógica.

```typescript
export interface BlockchainInfo { chain: BitcoinChain; blocks: number; pruned: boolean; /* ... */ }
export interface MempoolInfo { size: number; mempoolminfee: number; /* ... */ }
export interface MempoolEntry { vsize: number; fees: MempoolEntryFees; 'bip125-replaceable': boolean; /* ... */ }
```

### `app/backend/src/bitcoin/BitcoinRPCAdapter.ts`

**Responsabilidade:** isolar o transporte JSON-RPC HTTP do node.
**Pattern aplicado:** Adapter — expõe a interface `BitcoinRPCClient`; o resto do
sistema depende dela, não da classe concreta.
**Dependências injetadas:** `BitcoinRPCConfig` (url, user, password, timeout) via construtor.

```typescript
export interface BitcoinRPCClient {
  getBlockchainInfo(): Promise<BlockchainInfo>
  getMempoolInfo(): Promise<MempoolInfo>
  getRawMempool(): Promise<Map<string, MempoolEntry>>
  estimateSmartFee(targetBlocks: number): Promise<FeeEstimate>
}
export class BitcoinRPCError extends Error { constructor(message: string, readonly code: number) }
export class BitcoinRPCAdapter implements BitcoinRPCClient { /* ... */ }
```

### `app/backend/src/bitcoin/BasePoller.ts`

**Responsabilidade:** ciclo start/stop/schedule sem overlap de polls, compartilhado
por qualquer poller do projeto.
**Pattern aplicado:** Template Method (hook `poll()`) + Observer (estende `EventEmitter`).
**Dependências injetadas:** nenhuma — é a base; subclasses injetam as próprias.

```typescript
export abstract class BasePoller extends EventEmitter {
  start(): void
  stop(): void
  get isRunning(): boolean
  protected abstract poll(): Promise<void>
}
```

### `app/backend/src/bitcoin/MempoolPoller.ts`

**Responsabilidade:** comparar o snapshot do mempool entre polls e emitir
`tx:added`, `tx:removed`, `fee:spike`.
**Pattern aplicado:** Observer (eventos) sobre Template Method (herda `BasePoller`).
**Dependências injetadas:** `BitcoinRPCClient` via construtor.

```typescript
export class MempoolPoller extends BasePoller {
  constructor(rpc: BitcoinRPCClient, options?: MempoolPollerOptions)
}
// eventos: 'tx:added' | 'tx:removed' | 'fee:spike' | 'poll:error' (herdado de BasePoller)
```

### `app/backend/scripts/watch-mempool.ts`

**Responsabilidade:** wiring manual — instancia adapter + poller com as env vars
reais e imprime cada evento no console. Substitui, por enquanto, o wiring que viria
do entry point do servidor (que ainda não existe).

### `app/backend/.env.example`

Template com `BITCOIN_RPC_URL`, `BITCOIN_RPC_USER`, `BITCOIN_RPC_PASSWORD`,
`MEMPOOL_POLL_INTERVAL_MS`. `.env` real (gitignored) foi criado localmente com as
mesmas credenciais do `bitcoin_node/bitcoin_conf.md`.

---

## Wiring — como conectar ao sistema

```typescript
// app/backend/scripts/watch-mempool.ts
const adapter = new BitcoinRPCAdapter({ url, user, password })
const poller = new MempoolPoller(adapter, { intervalMs: 5000 })

poller.on('tx:added', (e) => console.log('[tx:added]', e.txid))
poller.on('tx:removed', (e) => console.log('[tx:removed]', e.txid))
poller.on('fee:spike', (e) => console.log('[fee:spike]', e.deltaPct))
poller.on('poll:error', (err) => console.error(err))

poller.start()
```

Quando o `EventStore`/`EventBus` existirem (próximas features), o consumidor desses
eventos muda — o `MempoolPoller` não muda, porque ele só emite (SRP/Open-Closed).

---

## Testes escritos

Nenhum nesta rodada — pulados a pedido explícito do usuário. Ver `review.md` para o
impacto disso e a recomendação de quando retomar.

---

## Desvios do plano

- **Nome da classe abstrata:** o plano usava `Poller`; implementado como `BasePoller`
  para seguir a convenção do próprio projeto (prefixo `Base`, ex: `BaseHandler`).
- **Testes não escritos:** o plano previa `BitcoinRPCAdapter.test.ts` e
  `MempoolPoller.test.ts` com mocks (sem executar). O usuário pediu para pular os
  testes por agora. As interfaces (`BitcoinRPCClient`) já estão desenhadas para
  serem mockáveis sem violar Liskov quando os testes forem escritos depois.
- **Validação manual em vez de unitária:** a verificação desta feature foi feita
  rodando `scripts/watch-mempool.ts` e um probe ad-hoc contra o node real
  (`bitcoin_node/docker-compose.yml`), confirmando tipos corretos e nenhum
  `poll:error`. O mempool está vazio porque o node ainda está em
  `initialblockdownload` — não é uma falha do adapter/poller.
