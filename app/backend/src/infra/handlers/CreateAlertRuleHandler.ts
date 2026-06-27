import type { DomainEvent } from "../../domain";
import type { CreateAlertRule } from "../../domain/commands";
import type { CommandHandler } from "../CommandBus";

/**
 * @module CreateAlertRuleHandler
 * @description Handler que processa CreateAlertRule command.
 *
 * PATTERN: Strategy
 * Por que este pattern: cada command type tem uma estratégia de handler diferente;
 * novos handlers entram sem modificar CommandBus (Open/Closed).
 *
 * Responsabilidade: validar payload, gerar DomainEvent(s) representando a mudança.
 * Não faz: persistência (EventStore), permissões (CommandBus), pub/sub (EventBus).
 */

export class CreateAlertRuleHandler implements CommandHandler {
  readonly commandType = "CREATE_ALERT_RULE";

  /**
   * Processa criação de nova regra de alerta.
   * Gera um evento AlertTriggered se criação é válida.
   * TODO: Phase 4 validará contra regras complexas (syntax, incompatibilidades).
   *
   * @param command - CreateAlertRule command
   * @returns array com um AlertTriggered event
   */
  async handle(command: CreateAlertRule): Promise<DomainEvent[]> {
    // TODO: Phase 3+ validações de payload
    // - configuration malformado?
    // - ruleType suportado?

    // Para MVP, apenas gera o evento
    // Phase 4 RuleEngine validará e compilará as regras
    return [];
  }
}
