# rule-engine — Revisão

**Branch:** `feature/rule-engine`
**Data:** 2026-06-27
**Status:** Pronto para PR (sem testes unitários — pulados a pedido do dev)

---

## Resumo

Implementado o RuleEngine (Phase 4): avalia eventos de domínio publicados no EventBus contra
regras de alerta configuradas via `AlertRuleBuilder`, e despacha commands (`TriggerAlert`,
`UpdatePeerStatus`) através do CommandBus quando as condições casam. Três matchers de condição
(`FeeSpikeMatcher`, `TransactionSizeMatcher`, `PeerCountMatcher`) implementam Strategy para os
tipos de condição do MVP. Foi necessário criar o command `TriggerAlert` + seu handler, já que
`AlertTriggered` existia apenas como DomainEvent sem um Command correspondente em Phase 3.

---

## Checklist SOLID

| Arquivo | S | O | L | I | D | Observações |
|---------|---|---|---|---|---|-------------|
| `RuleEngine.ts` | ✅ | ⚠️ | ✅ | ✅ | ✅ | O: subscrição depende de lista explícita `ALL_EVENT_TYPES` (EventBus não suporta wildcard) — novo tipo de evento exige editar essa lista |
| `AlertRuleBuilder.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `ConditionMatcher.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | interface mínima |
| `Rule.ts` | ✅ | ✅ | N/A | ✅ | N/A | tipos puros |
| `FeeSpikeMatcher.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `TransactionSizeMatcher.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `PeerCountMatcher.ts` | ⚠️ | ✅ | ✅ | ✅ | ✅ | S: mantém estado interno (contagem) além de avaliar — aceito como trade-off, ver Phase 5 |
| `TriggerAlert.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | segue padrão de Command existente |
| `TriggerAlertHandler.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | segue padrão de Handler existente |
| `CommandBus.ts` (modificado) | ✅ | ⚠️ | ✅ | ✅ | ✅ | O: novo case TRIGGER_ALERT exigiu editar `validatePermissions` (switch existente) — mesma limitação já presente antes da feature |

---

## Checklist de documentação

- [x] `@module` em todos os arquivos novos
- [x] JSDoc em todos os métodos públicos
- [x] `@throws` documentado onde aplicável (AlertRuleBuilder)
- [x] Decisões de design registradas em `plan.md`

---

## Checklist de testes

- [ ] Happy path — **pulado a pedido do dev**
- [ ] Edge cases — **pulado a pedido do dev**
- [ ] Erros esperados — **pulado a pedido do dev**
- [ ] Mocks isolam I/O externo — N/A (nenhum teste escrito)
- [ ] Nomes descrevem comportamento — N/A

Casos planejados permanecem documentados em `plan.md` § Testes planejados para quando o dev
decidir retomar a cobertura.

---

## Trade-offs conhecidos

1. **PeerCountMatcher com estado em memória** — contagem de peers não sobrevive a restart do
   processo nem é compartilhada entre múltiplas instâncias do backend. Aceitável para MVP
   single-instance; Phase 5 (Redis) é o lugar natural para mover esse estado.
2. **EventBus sem wildcard subscribe** — RuleEngine precisa conhecer e listar todos os tipos de
   evento manualmente. Alternativa (adicionar wildcard ao EventBus) foi descartada por estar fora
   do escopo desta feature e por arriscar quebrar contratos de Phase 3 já testados.
3. **Regras com condições de tipos de evento diferentes nunca casam** — como cada avaliação é
   feita contra um único evento por vez, uma regra com `whenFeeSpike(...).whenTransactionSize(...)`
   nunca seria satisfeita (nenhum evento único é ao mesmo tempo MemPoolFeeSpike e
   TransactionDetected). Combinações cross-evento exigiriam uma janela de estado temporal — fora
   do escopo do MVP. Regras práticas devem usar condições do mesmo tipo de evento.
4. **Sem testes unitários** — pulados nesta rodada a pedido explícito do dev.

## Fora do escopo

- Persistência de regras (`rule_definitions` table já existe em Phase 2, mas RuleEngine ainda
  recebe regras via `addRule()` em memória — carregamento do banco é Phase 5).
- Bootstrap/entrypoint real (tRPC, Phase 5) — documentado como snippet em `implementation.md`.
- Testes unitários (ver `plan.md` § Testes planejados).

## Próximos passos sugeridos

1. Phase 5: criar bootstrap real que carrega `rule_definitions` do Postgres e popula
   `RuleEngine.addRule()` no startup.
2. Phase 5: mover estado do `PeerCountMatcher` para Redis para suportar múltiplas instâncias.
3. Quando retomado, escrever os testes já planejados em `plan.md`.
4. Considerar suporte a condições cross-evento (janela temporal) se um caso de uso real exigir.

---

## Descrição do PR

```markdown
## O que faz
Implementa o RuleEngine (Phase 4): avalia eventos de domínio contra regras de alerta e despacha
commands (TriggerAlert, UpdatePeerStatus) via CommandBus quando as condições casam.

## Por que
Bridges Phase 3 (event sourcing) e Phase 5 (automação/UI) — sem isso, regras criadas via
CreateAlertRule ficam dormentes, sem nenhuma lógica reagindo a eventos do mempool/peers/blocos.

## Como
- `RuleEngine` (Chain of Responsibility): subscreve a todos os tipos de evento conhecidos,
  avalia cada um contra as regras ativas, despacha a ação (Strategy via `ConditionMatcher`).
- `AlertRuleBuilder` (Builder): DSL fluente para compilar regras
  (`.whenFeeSpike(20).triggerAlert(...)`).
- Três `ConditionMatcher`: FeeSpike, TransactionSize, PeerCount (com estado interno).
- Novo Command `TriggerAlert` + `TriggerAlertHandler`, já que `AlertTriggered` só existia como
  DomainEvent em Phase 3 — necessário para o RuleEngine despachar via CommandBus.

## Testes
Nenhum nesta rodada — pulados a pedido do dev. Casos planejados em
`docs/features/rule-engine/plan.md`.

## Documentação
- docs/features/rule-engine/plan.md
- docs/features/rule-engine/implementation.md
- docs/features/rule-engine/review.md

## Checklist
- [x] SOLID verificado em todos os arquivos (2 trade-offs documentados, ver review.md)
- [x] JSDoc em todos os métodos públicos
- [ ] Testes unitários escritos (pulado a pedido do dev)
- [x] Documentação atualizada
```
