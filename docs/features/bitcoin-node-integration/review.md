# bitcoin-node-integration — Revisão

**Branch:** `feature/bitcoin-node-integration`
**Data:** 2026-06-27
**Status:** Pronto para PR (sem testes automatizados — risco aceito, ver abaixo)

---

## Resumo

Primeira fatia vertical do projeto: o backend agora conecta a um Bitcoin Core real
via `BitcoinRPCAdapter` (Adapter) e observa o mempool via `MempoolPoller` (Observer +
Template Method sobre `BasePoller`), emitindo `tx:added` / `tx:removed` / `fee:spike`.
Validado contra o node real do `bitcoin_node/docker-compose.yml` — sem testes
automatizados nesta rodada, a pedido do usuário.

---

## Checklist SOLID

| Arquivo | S | O | L | I | D | Observações |
|---------|---|---|---|---|---|-------------|
| `bitcoin.types.ts` | ✅ | ✅ | — | ✅ | — | Só tipos, sem comportamento — S/O/L/D não se aplicam de forma significativa |
| `BitcoinRPCAdapter.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | `BitcoinRPCClient` é a abstração que o resto do sistema importa, não a classe |
| `BasePoller.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | Novo comportamento entra por subclasse (`poll()`), nunca por editar `BasePoller` |
| `MempoolPoller.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | Recebe `BitcoinRPCClient` por injeção — não instancia `BitcoinRPCAdapter` internamente |
| `scripts/watch-mempool.ts` | ✅ | — | — | — | — | Script de wiring, não é código de domínio — SOLID não se aplica da mesma forma |

---

## Checklist de documentação

- [x] @module em todos os arquivos
- [x] JSDoc em todos os métodos públicos
- [x] @throws documentado onde aplicável (`BitcoinRPCAdapter`)
- [x] Decisões de design registradas em `plan.md`

---

## Checklist de testes

- [ ] Happy path — **não feito**
- [ ] Edge cases — **não feito**
- [ ] Erros esperados — **não feito**
- [ ] Mocks isolam I/O externo — **não feito**
- [ ] Nomes descrevem comportamento — N/A

Pulado a pedido explícito do usuário nesta rodada. Ver "Trade-offs conhecidos".

---

## Trade-offs conhecidos

- **Sem suíte automatizada:** a validação foi 100% manual (typecheck + execução
  real contra o node). Isso é aceitável para uma primeira fatia exploratória, mas
  qualquer regressão futura no diff do mempool ou no parsing do envelope JSON-RPC
  não vai ser pega automaticamente. `BitcoinRPCClient` já foi desenhado para ser
  mockável (Liskov) quando os testes forem retomados — o custo de adiar é baixo.
- **`fee:spike` não foi observado com dado real:** o node está em
  `initialblockdownload` com mempool vazio, então o caminho de detecção de spike só
  foi validado por leitura de código, não por execução. O caminho de `tx:added` /
  `tx:removed` tem a mesma limitação.
- **`BasePoller` é uma abstração antecipada de um único consumidor real até agora**
  (`MempoolPoller`). O segundo consumidor (`BlockWatcher`) está nomeado na
  arquitetura do projeto mas não foi construído — risco baixo de over-engineering,
  mas é uma aposta, não um fato consumado.

## Fora do escopo

- `BlockWatcher.ts` — mesma família, não pedido agora.
- Domain layer (events/commands/specs), `EventStore`, `CommandBus`/`EventBus`,
  `RuleEngine`, tRPC, frontend — ordem definida pelo próprio usuário; vêm depois.
- `app/frontend` — nem tocado; não está nos workspaces do root `package.json` até
  ganhar seu próprio `package.json`.

## Próximos passos sugeridos

1. Quando o node terminar a IBD (ou usar `regtest`/`signet` para iterar mais rápido),
   re-rodar `scripts/watch-mempool.ts` para observar `tx:added`/`fee:spike` reais.
2. Retomar os testes unitários planejados em `plan.md` (`BitcoinRPCAdapter.test.ts`,
   `MempoolPoller.test.ts`) antes de empilhar a próxima feature sobre este código.
3. Seguir a ordem do roadmap: `schema.ts` (Drizzle, tabela `events` append-only) →
   domain layer → `EventStore` → `CommandBus`/`EventBus` → `RuleEngine` → tRPC → frontend.

---

## Descrição do PR

```markdown
## O que faz
Conecta o backend a um node Bitcoin Core real via JSON-RPC e observa o mempool,
emitindo eventos tipados de transação nova/removida e spike de fee.

## Por que
É a base de todo o projeto — sem dados reais do node, nenhuma camada seguinte
(event store, regras, frontend) tem o que processar.

## Como
- `BitcoinRPCAdapter` (Adapter) isola o transporte JSON-RPC HTTP atrás da interface
  `BitcoinRPCClient`.
- `BasePoller` (Template Method) generaliza o ciclo start/stop/schedule sem overlap,
  pensando no `BlockWatcher` que vem depois.
- `MempoolPoller` (Observer) faz diff de snapshots do mempool e emite
  `tx:added` / `tx:removed` / `fee:spike` / `poll:error`.

## Testes
Sem testes automatizados nesta rodada (pulado a pedido do usuário). Validado
manualmente: `tsc --noEmit` limpo, `scripts/watch-mempool.ts` rodando contra o node
real sem `poll:error`, e um probe ad-hoc confirmando os tipos de `getblockchaininfo`/
`getmempoolinfo`/`getrawmempool` batendo com a resposta real do node.

## Documentação
- docs/features/bitcoin-node-integration/plan.md
- docs/features/bitcoin-node-integration/implementation.md
- docs/features/bitcoin-node-integration/review.md

## Checklist
- [x] SOLID verificado em todos os arquivos
- [x] JSDoc em todos os métodos públicos
- [ ] Testes unitários escritos — pulado nesta rodada
- [x] Documentação atualizada
```
