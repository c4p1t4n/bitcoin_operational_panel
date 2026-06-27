# bitcoin-node-integration — Plano

**Branch:** `feature/bitcoin-node-integration`
**Data:** 2026-06-27
**Status:** Planejamento

---

## O que faz

Conecta o backend a um node Bitcoin Core real via JSON-RPC (Adapter) e expõe um poller
(Observer) que detecta mudanças no mempool — novas transações, transações removidas e
spikes de fee — emitindo eventos tipados que o resto do sistema vai consumir.

## Por que

É a base de todo o projeto: sem o adapter nada mais tem dados reais para processar, e
sem o poller não existe fluxo de eventos para alimentar o event store, as regras de
alerta e o frontend nas próximas features. Por design, esta feature para propositalmente
antes do event sourcing — o poller apenas emite, não persiste nem notifica (SRP).

## Escopo

### Inclui
- Tipos fortes para as respostas RPC usadas (`getblockchaininfo`, `getmempoolinfo`,
  `getrawmempool` verbose, `estimatesmartfee`)
- `BitcoinRPCAdapter` — isola o transporte HTTP/JSON-RPC do resto da aplicação
- `Poller` — classe abstrata (Template Method) com o ciclo start/stop/schedule sem
  overlap, reutilizável pelo `BlockWatcher` numa feature futura
- `MempoolPoller` — Observer concreto que faz diff de snapshots do mempool e emite
  `tx:added`, `tx:removed`, `fee:spike`
- Setup do workspace `app/backend` (package.json, tsconfig, vitest, tsx)
- Script manual (`scripts/watch-mempool.ts`) para validar contra o node real
- Testes unitários com mock do `BitcoinRPCClient` (sem tocar o node real)

### Não inclui (explicitamente fora do escopo)
- `BlockWatcher.ts` — mesma família de pattern, mas não foi pedido agora; o `Poller`
  base já deixa o caminho pronto
- Domain events, Command/EventStore/EventBus, RuleEngine, tRPC, frontend — vêm depois,
  nessa ordem, conforme o roadmap do projeto
- `app/frontend` — não foi tocado; root `package.json` não lista esse workspace ainda
  porque ele não tem `package.json` próprio até a feature de frontend começar

---

## Módulos afetados

| Arquivo | Tipo de mudança | Responsabilidade |
|---------|----------------|-----------------|
| `package.json` (raiz) | Modificação | Vira root de npm workspaces; remove deps que pertenciam ao app errado |
| `app/backend/package.json` | Criação | Manifesto do workspace backend |
| `app/backend/tsconfig.json` | Criação | Config TS (ESM, strict) do backend |
| `app/backend/.env.example` | Criação | Template de credenciais RPC |
| `app/backend/src/bitcoin/bitcoin.types.ts` | Criação | Tipos fortes do RPC do Bitcoin Core |
| `app/backend/src/bitcoin/BitcoinRPCAdapter.ts` | Criação | Adapter pattern — isola o node RPC |
| `app/backend/src/bitcoin/Poller.ts` | Criação | Template Method — ciclo de polling sem overlap |
| `app/backend/src/bitcoin/MempoolPoller.ts` | Criação | Observer — diff de mempool em eventos de domínio |
| `app/backend/scripts/watch-mempool.ts` | Criação | Wiring manual para validar contra o node real |

---

## Interfaces planejadas

### BitcoinRPCClient

```typescript
interface BitcoinRPCClient {
  getBlockchainInfo(): Promise<BlockchainInfo>
  getMempoolInfo(): Promise<MempoolInfo>
  getRawMempool(): Promise<Map<string, MempoolEntry>>
  estimateSmartFee(targetBlocks: number): Promise<FeeEstimate>
}
```

**Dependências injetadas:** nenhuma — é a borda do sistema com o mundo externo (HTTP).

### Poller (classe abstrata)

```typescript
abstract class Poller extends EventEmitter {
  start(): void
  stop(): void
  protected abstract poll(): Promise<void>
}
```

**Dependências injetadas:**
- Nenhuma na base — subclasses recebem as suas próprias (ex: `MempoolPoller` recebe um `BitcoinRPCClient`)

### MempoolPoller

```typescript
class MempoolPoller extends Poller {
  constructor(rpc: BitcoinRPCClient, options?: MempoolPollerOptions)
  protected poll(): Promise<void>
}
// eventos emitidos: 'tx:added' | 'tx:removed' | 'fee:spike' | 'poll:error'
```

**Dependências injetadas:**
- `BitcoinRPCClient` — fonte dos dados do mempool (real ou mock nos testes)

---

## Decisões de design

### Decisão 1: `Poller` abstrato em vez de `MempoolPoller` autônomo

**Contexto:** a árvore de arquivos do projeto já planeja um `BlockWatcher.ts` com o mesmo
comentário "Observer" e ambos precisam do mesmo ciclo de agendamento sem overlap.
**Opções consideradas:**
- Opção A: duplicar a lógica de start/stop/schedule em cada poller — simples agora, duplica bug depois
- Opção B: classe abstrata `Poller` com Template Method para o ciclo, subclasse implementa só o `poll()`
**Decisão:** Opção B. Não é especulação — o segundo consumidor (`BlockWatcher`) já está
nomeado na arquitetura do projeto, então a extração paga o custo agora em vez de duplicar.

### Decisão 2: tipos do RPC sem camada de mapeamento

**Contexto:** o `getrawmempool` verbose do Bitcoin Core retorna chaves como
`bip125-replaceable`, fora do padrão camelCase do projeto.
**Opções consideradas:**
- Opção A: mapear cada campo para um tipo "limpo" em camelCase
- Opção B: tipar exatamente o shape que o node retorna
**Decisão:** Opção B. `bitcoin.types.ts` existe para dar tipos fortes ao RPC, não para
remodelar o domínio — isso é responsabilidade da camada de domínio (feature futura). Uma
camada de mapeamento aqui seria responsabilidade duplicada (viola SRP do adapter).

### Decisão 3: workspaces sem `app/frontend` por enquanto

**Contexto:** `npm workspaces` exige que cada caminho listado tenha um `package.json`.
**Opções consideradas:**
- Opção A: criar um `package.json` vazio só para registrar o workspace
- Opção B: não listar `app/frontend` até a feature de frontend existir
**Decisão:** Opção B. Um manifesto vazio seria um artefato sem responsabilidade —
exatamente o tipo de "implementação pela metade" que o projeto quer evitar.

---

## Testes planejados

### BitcoinRPCAdapter.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path | Unit | `getBlockchainInfo` retorna `BlockchainInfo` tipado quando o node responde 200 com `result` |
| Happy path | Unit | `getRawMempool` converte o objeto verbose em `Map<string, MempoolEntry>` |
| Erro esperado | Unit | Lança `BitcoinRPCError` quando a resposta JSON-RPC tem `error` preenchido |
| Erro esperado | Unit | Lança `BitcoinRPCError` quando o HTTP status não é 2xx |
| Edge case | Unit | `getRawMempool` retorna `Map` vazio quando o mempool está vazio |

### MempoolPoller.test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path | Unit | Emite `tx:added` para cada txid novo entre dois polls |
| Happy path | Unit | Emite `tx:removed` para txid que saiu do mempool |
| Happy path | Unit | Emite `fee:spike` quando `mempoolminfee` sobe além do threshold configurado |
| Edge case | Unit | Não emite nada quando o snapshot não muda |
| Erro esperado | Unit | Emite `poll:error` (não lança) quando o `BitcoinRPCClient` rejeita |
| Integração | Integration | `watch-mempool.ts` roda contra o node real do `bitcoin_node/` e imprime eventos |

---

## Definition of done

- [ ] Todos os módulos implementados
- [ ] SOLID verificado em cada arquivo
- [ ] JSDoc em todos os métodos públicos
- [ ] Testes unitários escritos (não executados)
- [ ] plan.md, implementation.md e review.md criados
- [ ] PR description gerada
