# Templates de documentação

Use estes templates para gerar os três documentos de cada feature/fix.
Preencha todos os campos — seções vazias indicam planejamento incompleto.

---

## Template: plan.md

```markdown
# [nome-da-feature] — Plano

**Branch:** `feature/[nome-da-feature]`
**Data:** [data]
**Status:** Planejamento

---

## O que faz

[Uma frase clara descrevendo o comportamento do ponto de vista do usuário/sistema]

## Por que

[Contexto e motivação — qual problema resolve, por que agora]

## Escopo

### Inclui
- [item concreto]
- [item concreto]

### Não inclui (explicitamente fora do escopo)
- [item com justificativa]

---

## Módulos afetados

| Arquivo | Tipo de mudança | Responsabilidade |
|---------|----------------|-----------------|
| `src/bitcoin/MempoolPoller.ts` | Modificação | Adicionar detecção de X |
| `src/rules/handlers/XHandler.ts` | Criação | Strategy para condição X |

---

## Interfaces planejadas

### [NomeDoModulo]

```typescript
// Interface pública — definida antes da implementação
interface NomeDoModulo {
  metodo(param: Tipo): Promise<RetornoTipado>
}
```

**Dependências injetadas:**
- `DependenciaA` — para que serve
- `DependenciaB` — para que serve

---

## Decisões de design

### [Decisão 1: por que X e não Y]

**Contexto:** [qual era o problema]
**Opções consideradas:**
- Opção A: [prós / contras]
- Opção B: [prós / contras]
**Decisão:** [qual e por quê]

---

## Testes planejados

### [NomeDoModulo].test.ts

| Caso | Tipo | Descrição |
|------|------|-----------|
| Happy path | Unit | Retorna X quando Y |
| Edge case | Unit | Retorna Z quando entrada vazia |
| Erro esperado | Unit | Lança BitcoinRPCError quando node inacessível |
| Integração | Integration | Poller emite evento após detectar spike real |

---

## Definition of done

- [ ] Todos os módulos implementados
- [ ] SOLID verificado em cada arquivo
- [ ] JSDoc em todos os métodos públicos
- [ ] Testes unitários escritos (não executados)
- [ ] plan.md, implementation.md e review.md criados
- [ ] PR description gerada
```

---

## Template: implementation.md

```markdown
# [nome-da-feature] — Implementação

**Branch:** `feature/[nome-da-feature]`
**Data:** [data]
**Status:** Implementado

---

## Arquivos criados

### `src/[caminho]/[Arquivo].ts`

**Responsabilidade:** [o que faz]
**Pattern aplicado:** [nome do pattern e por quê]
**Dependências injetadas:** [lista]

```typescript
// Interface pública do módulo
```

---

## Arquivos modificados

### `src/[caminho]/[Arquivo].ts`

**O que mudou:** [descrição]
**Por que:** [justificativa]

```diff
+ linha adicionada
- linha removida
```

---

## Wiring — como conectar ao sistema

```typescript
// Em src/server/index.ts (ou onde for o ponto de boot)
const novoModulo = new NovoModulo(dep1, dep2)
existingModule.on('event', (e) => novoModulo.handle(e))
```

---

## Testes escritos

| Arquivo | Casos cobertos |
|---------|---------------|
| `__tests__/NovoModulo.test.ts` | 5 casos unitários |
| `__tests__/integration/NovoModulo.integration.test.ts` | 2 casos de integração |

---

## Desvios do plano

[Se houve qualquer diferença entre o plan.md e o que foi implementado, documente aqui com justificativa]
```

---

## Template: review.md

```markdown
# [nome-da-feature] — Revisão

**Branch:** `feature/[nome-da-feature]`
**Data:** [data]
**Status:** Pronto para PR

---

## Resumo

[2-3 frases descrevendo o que foi feito]

---

## Checklist SOLID

| Arquivo | S | O | L | I | D | Observações |
|---------|---|---|---|---|---|-------------|
| `NovoModulo.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `Handler.ts` | ✅ | ✅ | ✅ | ✅ | ✅ | — |

---

## Checklist de documentação

- [ ] @module em todos os arquivos
- [ ] JSDoc em todos os métodos públicos
- [ ] @throws documentado onde aplicável
- [ ] Decisões de design registradas em plan.md

---

## Checklist de testes

- [ ] Happy path
- [ ] Edge cases
- [ ] Erros esperados
- [ ] Mocks isolam I/O externo
- [ ] Nomes descrevem comportamento

---

## Trade-offs conhecidos

[O que foi deixado de lado conscientemente e por quê]

## Fora do escopo

[O que não foi feito e por quê — referência ao plan.md]

## Próximos passos sugeridos

[O que deveria ser feito depois desta feature]

---

## Descrição do PR

```markdown
## O que faz
[Uma frase]

## Por que
[Contexto e motivação]

## Como
[Abordagem técnica]

## Testes
[O que foi testado]

## Documentação
- docs/features/[nome]/plan.md
- docs/features/[nome]/implementation.md
- docs/features/[nome]/review.md

## Checklist
- [ ] SOLID verificado
- [ ] JSDoc completo
- [ ] Testes escritos
- [ ] Docs atualizadas
```
```
