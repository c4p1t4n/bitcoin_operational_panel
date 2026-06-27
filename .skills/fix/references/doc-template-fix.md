# Templates de documentação — Fix

---

## Template: plan.md (fix)

```markdown
# [nome-do-fix] — Plano

**Branch:** `fix/[nome-do-fix]`
**Data:** [data]
**Tipo:** [Isolado | Contrato | Concorrência | Integração | Regressão]
**Status:** Planejamento

---

## Diagnóstico

### Comportamento observado
[O que está acontecendo — específico, com passos para reproduzir se possível]

### Comportamento esperado
[O que deveria acontecer]

### Causa raiz
**Arquivo:** `src/[caminho]/[arquivo].ts`
**Linha(s):** [número]
**Mecanismo:** [por que o bug acontece — não apenas "linha X está errada"]

### Condições de ocorrência
- Sempre acontece? [Sim/Não — se não, em quais condições]
- Ambiente afetado: [desenvolvimento / produção / ambos]
- Impacto: [quem/o quê é afetado]

---

## Solução planejada

### Mudança mínima necessária

| Arquivo | Linha(s) | Mudança |
|---------|---------|---------|
| `src/[arquivo].ts` | 42 | [descrição da mudança] |

### Chamadores que precisam ser verificados

| Arquivo | Por quê verificar |
|---------|------------------|
| `src/trpc/routers/alerts.ts` | Chama o método modificado |

### O que NÃO será alterado (escopo do fix)

[Liste explicitamente o que fica de fora — especialmente refatorações que você
identificou mas que não fazem parte do fix]

---

## Teste de regressão

### Arquivo: `src/[caminho]/__tests__/[Modulo].test.ts`

```typescript
describe('[NomeDoModulo] — regressão', () => {
  it('reproduz bug: [descrição do comportamento errado]', async () => {
    // arrange
    // [setup do cenário que causava o bug]

    // act
    // [ação que disparava o bug]

    // assert
    // [o comportamento correto esperado]
  })
})
```

---

## Riscos do fix

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Quebrar chamador X | Baixa | Verificar todos os usos antes de commitar |

---

## Problemas identificados fora do escopo

[Liste outros problemas que você notou durante o diagnóstico mas que NÃO serão
corrigidos neste fix. Isso serve para criar issues separadas depois.]

- [ ] [Problema 1 — arquivo e descrição]
- [ ] [Problema 2 — arquivo e descrição]
```

---

## Template: implementation.md (fix)

```markdown
# [nome-do-fix] — Implementação

**Branch:** `fix/[nome-do-fix]`
**Data:** [data]
**Status:** Implementado

---

## Mudanças feitas

### `src/[caminho]/[arquivo].ts`

**Causa raiz:** [mecanismo do bug neste arquivo]

**Mudança:**
```diff
- linha com bug
+ linha corrigida
```

**Por que esta mudança corrige o bug:** [explicação]

---

## Chamadores verificados

| Arquivo | Impactado? | Ação tomada |
|---------|-----------|-------------|
| `src/trpc/routers/alerts.ts` | Não | Verificado, sem mudança necessária |
| `src/rules/RuleEngine.ts` | Sim | Atualizado para novo contrato |

---

## Teste de regressão escrito

**Arquivo:** `src/[caminho]/__tests__/[Modulo].regression.test.ts`
**Casos:** [quantos e o que cobrem]

---

## Desvios do plano

[Se a implementação diferiu do plan.md, documente com justificativa]
```

---

## Template: review.md (fix)

```markdown
# [nome-do-fix] — Revisão

**Branch:** `fix/[nome-do-fix]`
**Data:** [data]
**Status:** Pronto para PR

---

## Resumo

**Bug:** [descrição em uma frase]
**Causa raiz:** [mecanismo em uma frase]
**Fix:** [mudança mínima feita em uma frase]

---

## Checklist do fix

- [ ] Fix é mínimo — apenas linhas relacionadas ao bug
- [ ] Teste de regressão escrito
- [ ] Todos os chamadores verificados
- [ ] SOLID não violado

## Checklist SOLID

| Arquivo modificado | S | O | L | I | D |
|-------------------|---|---|---|---|---|
| `[arquivo].ts` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Este bug poderia ter sido evitado?

[Reflexão honesta — foi falta de teste? Design problem? Documentação ausente?
Isso alimenta melhorias no processo, não culpa.]

## Problemas identificados fora do escopo

[Issues para criar após o merge]
- [ ] [Problema 1]

---

## Descrição do PR

```markdown
## Tipo
Bug fix

## O que estava errado
[Comportamento observado — específico]

## Causa raiz
[Arquivo, linha, mecanismo]

## Correção
[Mudança mínima feita]

## Teste de regressão
[Localização e o que verifica]

## Verificações
- [ ] Chamadores do módulo verificados
- [ ] SOLID não violado
- [ ] Fix mínimo — sem refatorações não relacionadas

## Docs
- docs/features/[nome]/plan.md
- docs/features/[nome]/implementation.md
- docs/features/[nome]/review.md
```
```
