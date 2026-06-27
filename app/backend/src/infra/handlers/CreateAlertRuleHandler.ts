import { randomUUID } from "node:crypto";
import type { DomainEvent } from "../../domain";
import { AlertRuleCreated } from "../../domain/events";
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
 * Responsabilidade: validar payload, gerar o evento AlertRuleCreated.
 * Não faz: persistência (EventStore), permissões (CommandBus), pub/sub (EventBus),
 * gravação em `rule_definitions` (responsabilidade do RuleDefinitionProjector, que
 * reage a este evento via EventBus).
 */

export class CreateAlertRuleHandler implements CommandHandler {
  readonly commandType = "CREATE_ALERT_RULE";

  /**
   * Processa criação de nova regra de alerta.
   * O aggregateId do command, se fornecido, identifica a regra; caso contrário um novo
   * id é gerado aqui — isso permite que o caller (tRPC router) não precise gerar UUID.
   *
   * @param command - CreateAlertRule command
   * @returns array com um AlertRuleCreated event
   * @throws Error se `configuration` estiver vazio
   */
  async handle(command: CreateAlertRule): Promise<DomainEvent[]> {
    const { name, description, ruleType, configuration, requestedByUserId } = command.payload;

    if (!configuration || Object.keys(configuration).length === 0) {
      throw new Error(`CreateAlertRule "${name}" requires a non-empty configuration`);
    }

    const aggregateId = command.aggregateId || randomUUID();

    const event = new AlertRuleCreated(aggregateId, 1, {
      name,
      description,
      ruleType,
      configuration,
      requestedByUserId,
    });

    return [event];
  }
}
