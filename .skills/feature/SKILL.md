---
name: feature
description: >
  Fluxo completo de desenvolvimento de novas features para o Bitcoin Operations Panel.
  Use SEMPRE que o usuário disser "feature", "quero desenvolver", "implementar algo novo",
  "criar uma funcionalidade", "adicionar suporte a", ou descrever algo que ainda não existe no sistema.
  Executa obrigatoriamente três fases em sequência: Planejamento → Implementação → Revisão.
  Cria branch `feature/{nome}`, documenta em `docs/features/{nome}/`, SOMENTE QUANDO SOLICITADO gere testes unitários
  e de integração (sem executá-los) e valida SOLID em cada arquivo gerado.
---

# Feature skill

Fluxo obrigatório para toda feature nova. Três fases, sem pular nenhuma.

---

## Fase 1 — Planejamento

**Antes de escrever uma linha de código**, execute este checklist completo.

### 1.1 Entender o escopo

Pergunte (ou infira do contexto) e documente:
- O que esta feature faz em uma frase?
- Quais arquivos/módulos existentes ela toca?
- Quais novos módulos ela cria?
- Há dependências externas novas?
- Qual é o critério de conclusão (definition of done)?

### 1.2 Nomear a feature

Gere um nome em `kebab-case` descritivo e curto. Exemplos:
- `mempool-fee-alert` — não `alert` (genérico) nem `mempool-fee-spike-alert-rule-creation` (longo)
- `presence-tracker` — não `websocket-presence`
- `event-replay-on-reconnect`

### 1.3 Criar a branch

```bash
git checkout main
git pull origin main
git checkout -b feature/{nome-da-feature}
```

Apresente o comando exato para o desenvolvedor executar.

### 1.4 Criar a documentação de planejamento

Crie `docs/features/{nome-da-feature}/plan.md` com a estrutura abaixo.
Leia `references/doc-template.md` para o template completo.

```
docs/features/{nome}/
├── plan.md        ← criado no planejamento
├── implementation.md  ← criado durante implementação
└── review.md      ← criado na revisão
```

### 1.5 Mapear interfaces antes de implementar

Para cada novo módulo, defina a interface pública **antes** do corpo:
- Quais métodos/funções expõe?
- Quais são os tipos de entrada e saída?
- Quais erros pode lançar?
- Quais dependências injeta (não instancia internamente)?

Isso garante o **D** (Dependency Inversion) e o **I** (Interface Segregation) do SOLID
antes de qualquer implementação.

### 1.6 Planejar os testes
SOMENTE QUANDO O DEV SOLICITAR EXPLICITAMENTE
Liste os casos de teste antes de implementar:
- Happy path
- Edge cases (entrada vazia, valor limite, concorrência)
- Casos de erro esperados
- Casos de integração se houver I/O externo

Documente em `plan.md` na seção `## Testes planejados`.

---

## Fase 2 — Implementação

Execute nesta ordem. Não implemente o próximo item antes de finalizar o anterior.

### 2.1 Ordem de implementação

```
1. Tipos e interfaces (sem implementação)
2. Testes (baseados no plano — sem executar)
3. Implementação das interfaces
4. Wiring (conectar ao resto do sistema)
5. Documentação de cada arquivo
```

Escrever testes antes da implementação não é opcional — é o que garante
que as interfaces fazem sentido antes de você estar comprometido com elas.

### 2.2 Constraints SOLID obrigatórias

Leia `references/solid-constraints.md` para exemplos concretos de cada princípio.

Para **cada arquivo gerado**, verifique:

**S — Single Responsibility**
- Essa classe/módulo tem exatamente uma razão para mudar?
- Se a resposta for "faz X e também Y", separe em dois módulos.

**O — Open/Closed**
- Comportamento novo entra por extensão (nova classe, novo handler, nova strategy)?
- Modificação do código existente para adicionar comportamento = violação.

**L — Liskov Substitution**
- Toda implementação de uma interface pode ser trocada por outra sem quebrar o chamador?
- Se uma implementação lança exceções que a interface não declara, é violação.

**I — Interface Segregation**
- A interface expõe apenas o que o chamador precisa?
- Se o chamador usa 2 de 8 métodos, a interface está grande demais.

**D — Dependency Inversion**
- Módulos de alto nível dependem de abstrações, não de implementações concretas?
- `new ConcreteService()` dentro de um módulo = violação. Use injeção.

### 2.3 Padrão de documentação por arquivo

Todo arquivo gerado deve ter:

```typescript
/**
 * @module NomeDoModulo
 * @description O que este módulo faz em uma frase.
 *
 * PATTERN: [Nome do pattern aplicado aqui]
 * Por que este pattern: [justificativa em uma frase]
 *
 * Responsabilidade: [o que este módulo faz]
 * Não faz: [o que explicitamente não é responsabilidade deste módulo]
 *
 * Dependências injetadas:
 * - NomeDependencia: para que serve
 */
```

Cada método/função pública deve ter:

```typescript
/**
 * [O que faz em uma frase imperativa]
 *
 * @param nomeParam - O que representa
 * @returns O que retorna
 * @throws NomeDoErro - Quando lança
 */
```

### 2.4 Nomenclatura

- Interfaces: prefixo `I` nunca — use nomes descritivos (`EventStore`, não `IEventStore`)
- Classes abstratas: sufixo `Base` quando necessário (`BaseHandler`)
- Erros: sufixo `Error` (`OptimisticConcurrencyError`)
- Tipos de evento: `SCREAMING_SNAKE_CASE` (`FEE_SPIKE_DETECTED`)
- Arquivos: `PascalCase` para classes, `camelCase` para utils, `kebab-case` para configs

### 2.5 Estrutura de testes

Crie os arquivos de teste em `__tests__/` ao lado do módulo:

```
src/
  bitcoin/
    BitcoinRPCAdapter.ts
    __tests__/
      BitcoinRPCAdapter.test.ts
```

Use a estrutura `describe / it / expect` do Vitest (padrão do projeto):

```typescript
/**
 * @test BitcoinRPCAdapter
 * Testa o adapter de forma isolada com mock do fetch.
 * Não testa a integração com o node real — isso é responsabilidade
 * dos testes de integração em __tests__/integration/.
 */
describe('BitcoinRPCAdapter', () => {
  describe('getMempoolInfo', () => {
    it('retorna MempoolInfo tipado quando o node responde com sucesso', async () => {
      // arrange
      // act
      // assert
    })

    it('lança BitcoinRPCError quando o node retorna erro JSON-RPC', async () => {
      // arrange
      // act
      // assert
    })
  })
})
```

**NUNCA execute os testes.** Deixe isso ao cargo do desenvolvedor.

### 2.6 Atualizar `docs/features/{nome}/implementation.md`

Ao terminar a implementação, crie o documento de implementação.
Leia `references/doc-template.md` para o template.

---

## Fase 3 — Revisão

### 3.1 Checklist SOLID por arquivo

Para cada arquivo implementado, execute e documente:

```
[ ] S — Módulo tem uma única responsabilidade?
[ ] O — Comportamento novo entra por extensão?
[ ] L — Todas as implementações são substituíveis?
[ ] I — Interface tem apenas o que o chamador precisa?
[ ] D — Dependências são injetadas, não instanciadas?
```

Se qualquer item falhar, refatore antes de avançar.

### 3.2 Checklist de documentação

```
[ ] Todos os arquivos têm @module com descrição
[ ] Todos os métodos públicos têm JSDoc
[ ] Erros documentados com @throws
[ ] plan.md criado e completo
[ ] implementation.md criado e completo
[ ] Decisões de design documentadas (por que X e não Y)
```

### 3.3 Checklist de testes

```
[ ] Happy path coberto
[ ] Edge cases cobertos
[ ] Erros esperados testados
[ ] Mocks isolam dependências externas (node RPC, Redis, Postgres)
[ ] Nomes dos testes descrevem o comportamento, não a implementação
```

### 3.4 Gerar review.md

Crie `docs/features/{nome}/review.md` com:
- Resumo das mudanças
- Decisões de design e por quê
- Trade-offs conhecidos
- O que ficou fora do escopo (e por quê)
- Sugestões de próximos passos

### 3.5 Gerar descrição do PR

Produza uma descrição de PR pronta para copiar:

```markdown
## O que faz
[Uma frase]

## Por que
[Contexto e motivação]

## Como
[Abordagem técnica — patterns usados, decisões de design]

## Testes
[O que foi testado e como]

## Documentação
- docs/features/{nome}/plan.md
- docs/features/{nome}/implementation.md
- docs/features/{nome}/review.md

## Checklist
- [ ] SOLID verificado em todos os arquivos
- [ ] JSDoc em todos os métodos públicos
- [ ] Testes unitários escritos
- [ ] Documentação atualizada
```

---

## Referências

- `references/solid-constraints.md` — exemplos concretos de cada princípio com código do projeto
- `references/doc-template.md` — templates de plan.md, implementation.md e review.md
