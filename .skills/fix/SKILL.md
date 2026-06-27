---
name: fix
description: >
  Fluxo completo de correção de bugs para o Bitcoin Operations Panel.
  Use SEMPRE que o usuário disser "fix", "corrigir", "bug", "erro", "quebrado",
  "não está funcionando", "comportamento errado", "regressão", ou descrever algo
  que deveria funcionar mas não funciona.
  Executa obrigatoriamente três fases: Planejamento → Implementação → Revisão.
  Cria branch `fix/{nome}`, identifica a causa raiz antes de tocar no código,
  escreve teste de regressão, documenta em `docs/features/{nome}/` e valida
  que o fix não viola SOLID nem introduz novos problemas.
---

# Fix skill

Fluxo obrigatório para toda correção de bug. Três fases, sem pular nenhuma.
A diferença principal em relação à feature: **o plano vem antes do código, sempre**.
Fixes apressados sem diagnóstico são a principal causa de regressões.

---

## Fase 1 — Planejamento

### 1.1 Diagnosticar antes de tocar em código

Antes de qualquer modificação, responda:

**O que está acontecendo?**
[Comportamento observado — seja específico. "Erro no WebSocket" não é suficiente.
"WebSocket não entrega eventos após reconexão quando globalSeq > 1000" é suficiente.]

**O que deveria acontecer?**
[Comportamento esperado, idealmente com referência à documentação ou ao plan.md da feature]

**Onde está a causa raiz?**
[Identifique o arquivo e a linha. Não comece o fix sem isso.]

**Por que acontece?**
[Mecanismo do bug — não apenas "linha X está errada", mas "linha X assume Y mas na verdade Z"]

**Qual é o impacto?**
[Quem/o quê é afetado. Sempre acontece ou só em condições específicas?]

### 1.2 Classificar o fix

| Tipo | Descrição | Atenção extra |
|------|-----------|---------------|
| **Isolado** | Uma função/método com lógica errada | Menor risco |
| **Contrato** | Interface ou tipo está errado | Verificar todos os chamadores |
| **Concorrência** | Race condition, deadlock, estado compartilhado | Verificar threading/async |
| **Integração** | Problema na borda entre módulos | Verificar ambos os lados |
| **Regressão** | Algo que funcionava parou de funcionar | Encontrar o commit que quebrou |

### 1.3 Nomear o fix

Use `kebab-case` descritivo. Exemplos:
- `websocket-replay-off-by-one` — não `ws-fix`
- `mempool-poller-memory-leak` — não `poller-bug`
- `event-store-version-conflict-handling`

### 1.4 Criar a branch

```bash
git checkout main
git pull origin main
git checkout -b fix/{nome-do-fix}
```

Apresente o comando exato para o desenvolvedor executar.

### 1.5 Criar documentação de planejamento

Crie `docs/features/{nome-do-fix}/plan.md`.
Leia `references/doc-template-fix.md` para o template específico de fix.

### 1.6 Planejar o teste de regressão ANTES de corrigir

Todo fix deve ter um teste que:
1. **Reproduz o bug** — falha antes do fix
2. **Passa após o fix** — comprova que foi corrigido
3. **Permanece no codebase** — garante que o bug não volta

Escreva o teste antes de corrigir. Se você não consegue escrever um teste que reproduza o bug,
você ainda não entendeu o bug completamente. Volte para o diagnóstico.

```typescript
describe('NomeDoModulo — regressão', () => {
  it('reproduz bug #[referência]: [descrição do comportamento errado]', async () => {
    // arrange — cenário que causava o bug
    // act — ação que disparava o bug
    // assert — o que deveria acontecer (não o que acontecia antes do fix)
  })
})
```

**NUNCA execute os testes.** Deixe isso ao cargo do desenvolvedor.

---

## Fase 2 — Implementação

### 2.1 Princípio do fix mínimo

**Faça a menor mudança possível que corrija o bug.**

Um fix não é uma oportunidade de refatorar código não relacionado.
Se você perceber outros problemas durante o fix, documente em `review.md`
na seção "Problemas identificados fora do escopo" e crie issues separadas.

### 2.2 Checklist antes de modificar cada linha

- [ ] Esta modificação é necessária para corrigir o bug?
- [ ] Esta modificação introduz quebra de interface (L do SOLID)?
- [ ] Esta modificação altera o contrato de alguma função pública?
- [ ] Se altera contrato: todos os chamadores foram atualizados?

### 2.3 Constraints SOLID no fix

Leia `references/solid-constraints.md` para exemplos completos.

Atenção especial para fixes:

**S — Não adicione responsabilidades ao corrigir**
```typescript
// ❌ Fix de bug no poller que "aproveita" para adicionar logging de tudo
async poll() {
  const data = await this.adapter.getMempoolInfo()
  console.log('[poll] data:', data)  // ← logging não é responsabilidade do poller
  this.emit('event', { ... })
  console.log('[poll] event emitted')  // ← isso vai virar dívida técnica
}

// ✅ Fix cirúrgico — corrige apenas o que estava errado
async poll() {
  const data = await this.adapter.getMempoolInfo()
  this.emit('event', { type: 'MEMPOOL_UPDATED', payload: data })
}
```

**O — Fix não deve exigir modificar código estável**
Se o fix exige modificar 5 arquivos não relacionados, o design original violava Open/Closed.
Documente isso em `review.md` como problema de design identificado, não conserte agora.

**D — Não introduza dependências concretas para "facilitar" o fix**
```typescript
// ❌ Fix que instancia Redis diretamente para resolver um problema de timing
class EventStore {
  private redis = new Redis()  // ← introduzido no fix para "contornar" o problema

// ✅ Fix que resolve o problema sem criar nova dependência concreta
class EventStore {
  constructor(private readonly eventBus: EventBus) {}  // ← injetado como antes
```

### 2.4 Documentar a causa raiz no código

Adicione um comentário na linha corrigida explicando o bug:

```typescript
// FIX: globalSeq era comparado com >= quando deveria ser > (off-by-one).
// Eventos com seq igual ao último recebido eram descartados na reconexão,
// causando perda do último evento antes da desconexão.
// Ref: docs/features/websocket-replay-off-by-one/plan.md
const missedEvents = await eventStore.getEventsAfter(lastSeq)  // era getEventsAfter(lastSeq + 1)
```

### 2.5 Verificar efeito colateral nos chamadores

Para qualquer modificação de interface ou comportamento público:

```bash
# Liste todos os arquivos que importam o módulo modificado
grep -r "from.*NomeDoModulo" src/ --include="*.ts"
```

Verifique cada chamador e confirme que o fix não quebra nenhum deles.
Se quebrar, corrija também — mas documente em `implementation.md`.

### 2.6 Atualizar `docs/features/{nome}/implementation.md`

---

## Fase 3 — Revisão

### 3.1 Verificar que o fix é mínimo

```
[ ] Apenas linhas relacionadas ao bug foram modificadas
[ ] Nenhuma refatoração não relacionada foi incluída
[ ] Nenhuma feature nova foi adicionada junto
```

Se qualquer item falhar, separe as mudanças em PRs distintos.

### 3.2 Checklist SOLID

Para cada arquivo modificado:

```
[ ] S — Fix não adicionou nova responsabilidade ao módulo?
[ ] O — Fix não exigiu modificar código estável não relacionado?
[ ] L — Comportamento ainda é substituível — contratos mantidos?
[ ] I — Nenhuma interface foi expandida desnecessariamente?
[ ] D — Nenhuma dependência concreta nova foi introduzida?
```

### 3.3 Checklist do teste de regressão

```
[ ] Teste reproduz o cenário exato do bug
[ ] Teste falha sem o fix (confirmado na análise, não executado)
[ ] Teste passa com o fix
[ ] Nome do teste descreve o comportamento, não a implementação
[ ] Teste está em local correto (__tests__ ao lado do módulo)
```

### 3.4 Verificar chamadores

```
[ ] Todos os chamadores do código modificado foram verificados
[ ] Nenhuma interface pública foi quebrada sem atualizar os chamadores
[ ] Se tipo/interface mudou: shared package atualizado
```

### 3.5 Gerar review.md

Crie `docs/features/{nome-do-fix}/review.md` com:
- Causa raiz documentada claramente
- O que foi corrigido e como
- O que foi verificado para garantir que não há regressão
- Problemas relacionados identificados (mas fora do escopo do fix)
- O fix poderia ter sido evitado? Como?

### 3.6 Gerar descrição do PR

```markdown
## Tipo
Bug fix

## O que estava errado
[Comportamento observado — específico]

## Causa raiz
[Mecanismo do bug — arquivo, linha, por quê acontecia]

## O que foi corrigido
[Mudança mínima feita]

## Teste de regressão
[Descrição do teste escrito — localização e o que verifica]

## Verificações feitas
- [ ] Chamadores do módulo verificados
- [ ] SOLID não violado pelo fix
- [ ] Sem mudanças fora do escopo do bug

## Documentação
- docs/features/[nome]/plan.md
- docs/features/[nome]/implementation.md
- docs/features/[nome]/review.md
```

---

## Referências

- `references/solid-constraints.md` — exemplos concretos de cada princípio
- `references/doc-template-fix.md` — templates de plan.md, implementation.md e review.md para fixes
