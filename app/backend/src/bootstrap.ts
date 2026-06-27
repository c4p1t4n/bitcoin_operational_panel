import type { Database } from "./db";
import type { User } from "./domain/types";
import {
  EventBus,
  EventStore,
  CommandBus,
  CreateAlertRuleHandler,
  AcknowledgeAlertHandler,
  UpdatePeerStatusHandler,
  TriggerAlertHandler,
  RuleEngine,
  FeeSpikeMatcher,
  TransactionSizeMatcher,
  PeerCountMatcher,
  DrizzleRuleDefinitionRepository,
  RuleDefinitionProjector,
  RuleDefinitionCompiler,
} from "./infra";
import type { IEventBus } from "./infra/EventBus";
import type { ICommandDispatcher } from "./infra/CommandBus";

/** Ator de sistema usado pelo CommandBus quando o RuleEngine despacha um command — não há usuário autenticado nesse fluxo. */
const SYSTEM_USER: User = { id: "system", role: "ADMIN" };

export interface AppContext {
  eventBus: IEventBus;
  commandBus: ICommandDispatcher;
  ruleEngine: RuleEngine;
  ruleDefinitionProjector: RuleDefinitionProjector;
}

/**
 * @module bootstrap
 * @description Composition root — instancia e liga toda a camada de domínio/infra num
 * processo executável.
 *
 * PATTERN: Composition Root / Dependency Injection
 * Por que este pattern: nenhum módulo de domínio (CommandBus, EventStore, RuleEngine)
 * deve instanciar suas próprias dependências (Dependency Inversion); este é o único
 * lugar do sistema que faz `new` dos componentes concretos.
 *
 * Responsabilidade: ordem de wiring — EventBus → EventStore → CommandBus (+ handlers) →
 * RuleEngine (+ matchers) → carregar regras ativas de `rule_definitions` →
 * RuleDefinitionProjector → bootstrap do RuleEngine.
 * Não faz: servir requisições HTTP/WS (server.ts), acesso direto a tabelas fora de
 * `rule_definitions` (cada módulo usa seu próprio repository).
 *
 * @param db - cliente Drizzle já conectado
 * @returns AppContext com as instâncias usadas pelo tRPC context
 */
export async function bootstrap(db: Database): Promise<AppContext> {
  const eventBus = new EventBus();
  const eventStore = new EventStore(db, eventBus);

  // O RuleEngine despacha commands como o ator de sistema, nunca como usuário autenticado.
  const commandBus = new CommandBus(eventStore, eventBus, () => SYSTEM_USER);

  commandBus.register(new CreateAlertRuleHandler());
  commandBus.register(new AcknowledgeAlertHandler());
  commandBus.register(new UpdatePeerStatusHandler());
  commandBus.register(new TriggerAlertHandler());

  const ruleDefinitionRepository = new DrizzleRuleDefinitionRepository(db);
  const ruleDefinitionCompiler = new RuleDefinitionCompiler();
  const ruleDefinitionProjector = new RuleDefinitionProjector(eventBus, ruleDefinitionRepository);
  ruleDefinitionProjector.start();

  const ruleEngine = new RuleEngine(eventBus, commandBus);
  ruleEngine.registerMatcher(new FeeSpikeMatcher());
  ruleEngine.registerMatcher(new TransactionSizeMatcher());
  ruleEngine.registerMatcher(new PeerCountMatcher());

  const activeRules = await ruleDefinitionRepository.loadActive();
  for (const row of activeRules) {
    try {
      ruleEngine.addRule(ruleDefinitionCompiler.compile(row));
    } catch (err) {
      console.error(`bootstrap: skipping rule "${row.name}" — failed to compile:`, err);
    }
  }

  await ruleEngine.bootstrap();

  return { eventBus, commandBus, ruleEngine, ruleDefinitionProjector };
}
